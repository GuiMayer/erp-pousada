import { formatCurrency } from "@/lib/utils/formatters"
import { receiveTargets, payExpense } from "./settlements"
import { receiveStay, stayInclude } from "./stays"
import { requireVersion } from "./concurrency"
import { recordAudit } from "./audit"
import { can, demand } from "./permissions"
import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import type { Actor } from "./auth"
import { HttpError } from "./http"
import { collectionMapper } from "./db/relational-data-service"
import { businessDay, normalizePayment } from "../utils/business-values"
import { cashIncoming, distributePayment, type PaymentLine } from "@/lib/payments"
import { cancellationAmounts, cancellationReason, noShowEligible } from "@/lib/booking-flow"

type Tx = Prisma.TransactionClient
const id = z.string().trim().min(1).max(200)
const money = z.number().finite().nonnegative().max(999999999).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use no máximo duas casas decimais")
const positiveMoney = money.refine(value => value > 0, "Valor deve ser positivo")
export const paymentSchema = z.enum(["dinheiro", "pix", "debito", "credito", "Dinheiro", "PIX", "Cartao Debito", "Cartao Credito", "Cartão Débito", "Cartão Crédito"])
export const paymentLinesSchema = z.array(z.object({ method: paymentSchema, value: money, accountId: id.optional() }).strict()).min(1).max(8)
export const paymentFields = { paymentMethod: paymentSchema.optional(), accountId: id.optional(), payments: paymentLinesSchema.optional() }
const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value)

const audit = recordAudit

export async function recordLedger(tx: Tx, actor: Actor, reference: string, value: Prisma.Decimal, type = "receita", method?: string, requestedAccount?: string, origin: {batchId?:string;originType?:string;originId?:string;reversalOfId?:string} = {}) {
  const paymentMethod = method ? normalizePayment(method) : undefined
  let cashSessionId: string | undefined, accountId = requestedAccount
  if (paymentMethod === "Dinheiro") {
    if (accountId) throw new HttpError(400, "Pagamento em dinheiro utiliza o caixa, não uma conta bancária")
    const session = await tx.cashClose.findFirst({ where: { status: "aberto" } })
    if (!session) throw new HttpError(409, "Abra o caixa na Frente de Caixa antes de registrar dinheiro")
    if (!cashIncoming(type)) {
      const entries = await tx.transaction.findMany({ where: { cashSessionId: session.id } })
      const available = entries.reduce((sum, entry) => cashIncoming(entry.type) ? sum.plus(entry.value) : sum.minus(entry.value), session.openingValue)
      if (available.lt(value)) throw new HttpError(409, "Saldo em dinheiro insuficiente no turno")
    }
    cashSessionId = session.id
  } else if (paymentMethod) {
    if (!accountId) {
      const accounts = await tx.bankAccount.findMany({ where: { active: true }, take: 2 })
      if (accounts.length !== 1) throw new HttpError(400, "Selecione uma conta bancária ativa para este pagamento")
      accountId = accounts[0].id
    }
    const account = await tx.bankAccount.findUniqueOrThrow({ where: { id: accountId } })
    if (!account.active) throw new HttpError(409, "Conta bancária inativa")
    const incoming = type === "receita" || type === "transferencia_entrada"
    const updated = await tx.bankAccount.updateMany({ where: { id: account.id, ...(incoming ? {} : { currentBalance: { gte: value } }) }, data: { currentBalance: incoming ? { increment: value } : { decrement: value } } })
    if (!updated.count) throw new HttpError(409, "Saldo bancário insuficiente")
  }
  return tx.transaction.create({ data: { ...origin,id: randomUUID(), date: new Date(), description: reference, refId: reference, value, type, paymentMethod, accountId, cashSessionId, responsible: actor.username } })
}

export type PostedPayment = { transactionId: string; value: number; method: string }
export async function postPayments(tx: Tx, actor: Actor, reference: string, value: number, input: {paymentMethod?:string;accountId?:string;payments?:PaymentLine[]}, originType: string, originId: string, type='receita') {
  let plan: ReturnType<typeof distributePayment>
  try { plan=distributePayment(value,input.payments??[{method:input.paymentMethod??'',value,accountId:input.accountId}]) } catch(e) {throw new HttpError(400,(e as Error).message)}
  if (type!=='receita'&&plan.change)throw new HttpError(400,'Pagamento de despesa deve corresponder ao valor aplicado')
  const batchId=randomUUID(),posted:PostedPayment[]=[]
  for(const p of plan.lines) if(p.applied>0) {
    const entry=await recordLedger(tx,actor,reference,D(p.applied),type,p.method,p.accountId,{batchId,originType,originId})
    posted.push({transactionId:entry.id,value:p.applied,method:p.method})
  }
  return {...plan,batchId,posted}
}

export async function financeOperation(tx: Tx, actor: Actor, kind: string, payload: unknown): Promise<unknown | undefined> {
  if (kind === "cash-open") {
    const { openingValue, openingReason } = z.object({ openingValue: money, openingReason: z.string().trim().min(5).max(500).optional() }).strict().parse(payload)
    const previous = await tx.cashClose.findFirst({ where: { status: "fechado" }, orderBy: [{ closedAt: "desc" }, { id: "desc" }] })
    if (previous && !previous.retainedValue.equals(openingValue) && !openingReason) throw new HttpError(409, "O fundo difere do último fechamento. Informe o motivo da alteração.", { code: "CASH_OPENING_DIFFERENCE" })
    if (await tx.cashClose.count({ where: { status: "aberto" } })) throw new HttpError(409, "Já existe um caixa aberto")
    const now = new Date()
    const session = await tx.cashClose.create({ data: { id: randomUUID(), status: "aberto", date: now, openedAt: now, operator: actor.username, responsibleUserId: actor.id, openingValue, openingReason, previousSessionId: previous?.id, physicalValue: 0, expectedValue: openingValue, divergence: 0 } })
    await audit(tx, actor, "Caixa aberto", session.id, { entityType: "cashCloses", entityId: session.id, operation: "create", metadata: { openingValue, previousSessionId: previous?.id, openingReason, previousRetainedValue: previous ? Number(previous.retainedValue) : undefined } })
    return collectionMapper("cashCloses").toApp(session)
  }
  if (kind === "cash-close") {
    const input = z.object({ sessionId: id, physicalValue: money, retainedValue: money.optional(), withdrawalAccountId: id.optional(), closingReason: z.string().trim().min(5).max(500).optional() }).strict().parse(payload)
    const { sessionId, physicalValue } = input
    const session = await tx.cashClose.findUniqueOrThrow({ where: { id: sessionId } })
    if (session.status !== "aberto") throw new HttpError(409, "Caixa já fechado")
    if (session.responsibleUserId !== actor.id && !can(actor, "cash.closeAny")) throw new HttpError(403, "Somente o responsável ou supervisor pode fechar este caixa")
    const entries = await tx.transaction.findMany({ where: { cashSessionId: session.id } })
    const expectedValue = entries.reduce((sum, entry) => cashIncoming(entry.type) ? sum.plus(entry.value) : sum.minus(entry.value), session.openingValue)
    const divergence = D(physicalValue).minus(expectedValue)
    if (!divergence.isZero() && !input.closingReason) throw new HttpError(409, `Há diferença no caixa. Esperado: ${formatCurrency(Number(expectedValue))}. Contado: ${formatCurrency(physicalValue)}. Diferença: ${formatCurrency(Number(divergence))}. Reconte ou informe uma justificativa.`, { code: "CASH_DIFFERENCE" })
    const retainedValue = D(input.retainedValue ?? physicalValue)
    if (retainedValue.gt(physicalValue)) throw new HttpError(400, "O fundo não pode exceder o dinheiro contado")
    const withdrawnValue = D(physicalValue).minus(retainedValue)
    if (input.withdrawalAccountId) {
      demand(actor, "cash.move")
      if (withdrawnValue.lte(0)) throw new HttpError(400, "Informe um valor retirado para depositar")
      // The counted withdrawal is recorded on the closing; only a confirmed bank
      // deposit moves the bank balance. Neither custody nor deposit is revenue.
      await recordLedger(tx, actor, `Depósito do fechamento ${session.id}`, withdrawnValue, "transferencia_entrada", "pix", input.withdrawalAccountId, { originType: "cash-closing-deposit", originId: session.id, batchId: session.id })
    }
    const closed = await tx.cashClose.update({ where: { id: session.id }, data: { status: "fechado", date: new Date(), closedAt: new Date(), physicalValue, expectedValue, divergence, retainedValue, withdrawnValue, withdrawalAccountId: input.withdrawalAccountId, closingReason: input.closingReason, closedBy: actor.username } })
    await audit(tx, actor, "Caixa fechado", session.id, { entityType: "cashCloses", entityId: session.id, operation: "update", metadata: { physicalValue, expectedValue: Number(expectedValue), divergence: Number(divergence), retainedValue: Number(retainedValue), withdrawnValue: Number(withdrawnValue), withdrawalAccountId: input.withdrawalAccountId, closingReason: input.closingReason } })
    return { ...collectionMapper("cashCloses").toApp(closed) as object, incomingValue: Number(entries.filter(e => cashIncoming(e.type)).reduce((sum, e) => sum.plus(e.value), D(0))), outgoingValue: Number(entries.filter(e => !cashIncoming(e.type)).reduce((sum, e) => sum.plus(e.value), D(0))) }
  }
  if (kind === "cash-review") {
    const input = z.object({ sessionId: id, note: z.string().trim().min(5).max(500) }).strict().parse(payload)
    const session = await tx.cashClose.findUniqueOrThrow({ where: { id: input.sessionId } })
    if (session.status !== "fechado" || session.divergence.isZero()) throw new HttpError(409, "Somente fechamento com diferença permite conferência")
    if (session.reviewedAt) throw new HttpError(409, "Esta diferença já foi conferida")
    const reviewed = await tx.cashClose.update({ where: { id: session.id }, data: { reviewedAt: new Date(), reviewedBy: actor.username, reviewNote: input.note } })
    await audit(tx, actor, "Diferença de caixa conferida", session.id, { entityType: "cashCloses", entityId: session.id, operation: "update", metadata: { note: input.note } })
    return collectionMapper("cashCloses").toApp(reviewed)
  }
  if (kind === "pay-reservation") {
    const input = z.object({ reservationId: id, recordVersion: z.number().int().nonnegative().optional(), value: positiveMoney, paymentMethod: paymentSchema.or(z.literal("credito_hospede")).optional(), accountId: id.optional(),payments:paymentLinesSchema.optional() }).strict().parse(payload)
    const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: input.reservationId } })
    if (input.recordVersion !== undefined) requireVersion(input.recordVersion, reservation.recordVersion)
    if (!["confirmada", "checkin"].includes(reservation.status)) throw new HttpError(409, "Reserva não permite recebimento")
    if (D(input.value).gt(reservation.totalValue.minus(reservation.paidValue))) throw new HttpError(409, "Valor excede o saldo da hospedagem")
    const stay = await tx.stay.findUnique({ where: { reservationId: reservation.id }, include: stayInclude })
    if (stay) {
      await receiveStay(tx, actor, stay, input.value, input.paymentMethod, input.accountId, "lodging",input.payments)
      return collectionMapper("reservations").toApp(await tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } }))
    }
    if (input.paymentMethod === "credito_hospede") {
      const guest = await tx.guestProfile.findUnique({ where: { cpf: reservation.cpf } })
      if (reservation.payerId && reservation.payerId !== guest?.customerId) throw new HttpError(409, "Crédito pessoal não pode quitar conta da empresa")
      const changed = await tx.guestProfile.updateMany({ where: { cpf: reservation.cpf, creditValue: { gte: input.value } }, data: { creditValue: { decrement: input.value } } })
      if (!changed.count) throw new HttpError(409, "Crédito do hóspede insuficiente")
      await recordLedger(tx, actor, `Hospedagem ${reservation.id}`, D(input.value), "credito_utilizado")
    } else await postPayments(tx,actor,`Hospedagem ${reservation.id}`,input.value,input,"reservation",reservation.id)
    const updated = await tx.reservation.update({ where: { id: reservation.id }, data: { paidValue: { increment: input.value } } })
    await audit(tx, actor, "Hospedagem recebida", reservation.id, { entityType: "reservations", entityId: reservation.id, operation: "update" })
    return collectionMapper("reservations").toApp(updated)
  }
  if (kind === "cancel-reservation") {
    const input = z.object({ reservationId: id, recordVersion: z.number().int().nonnegative().optional(), status: z.enum(["cancelada", "noshow"]).default("cancelada"), decision: z.enum(["refund", "retain", "credit"]).optional(), refundValue: money.optional(), treatment: z.enum(["estorno", "multa", "credito"]).optional(), fee: money.default(0), cancellationReason, financialReason: z.string().trim().min(5).max(500).optional() }).strict().parse(payload)
    const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: input.reservationId } })
    if (input.recordVersion !== undefined) requireVersion(input.recordVersion, reservation.recordVersion)
    if (reservation.status !== "confirmada") throw new HttpError(409, "Somente reserva confirmada pode ser cancelada")
    const settings = await tx.systemSettings.findFirst()
    if (input.status === "noshow" && !noShowEligible(reservation.checkIn.toISOString().slice(0, 10), settings?.checkInTime ?? "14:00")) throw new HttpError(409, "Não registre no-show antes da chegada prevista e do horário configurado")
    if (reservation.paidValue.gt(0)) demand(actor, "reservations.paidCancel")
    let treatment = input.treatment ?? "estorno", fee = input.fee
    if (input.decision) {
      let amounts: ReturnType<typeof cancellationAmounts>
      try { amounts = cancellationAmounts(Number(reservation.paidValue), input.decision, input.refundValue) }
      catch (error) { throw new HttpError(400, (error as Error).message) }
      fee = amounts.retained; treatment = input.decision === "credit" ? "credito" : fee > 0 ? "multa" : "estorno"
    }
    if (fee > 0 || treatment === "credito") {
      demand(actor, "reservations.feeCredit")
      if (!input.financialReason) throw new HttpError(400, "Informe a justificativa financeira da retenção ou concessão de crédito")
    }
    if (D(fee).gt(reservation.paidValue) || (treatment === "estorno" && fee !== 0)) throw new HttpError(400, "Retenção não pode exceder o recebido; devolução integral não admite retenção")
    const remainder = reservation.paidValue.minus(fee)
    if (treatment === "credito" && remainder.gt(0)) {
      const guest = await tx.guestProfile.findUniqueOrThrow({ where: { cpf: reservation.cpf } })
      if (reservation.payerId && reservation.payerId !== guest.customerId) throw new HttpError(409, "Crédito da empresa não pode ser transferido para o hóspede")
      await tx.guestProfile.update({ where: { cpf: reservation.cpf }, data: { creditValue: { increment: remainder } } })
      await recordLedger(tx, actor, `Crédito cancelamento ${reservation.id}`, remainder, "credito_concedido")
    } else if (treatment !== "credito") {
      let remaining = remainder
      const receipts = await tx.transaction.findMany({ where: { refId: `Hospedagem ${reservation.id}`, type: { in: ["receita", "credito_utilizado"] } }, orderBy: [{ date: "desc" }, { id: "asc" }] })
      for (const receipt of receipts) {
        if (remaining.lte(0)) break
        const value = Prisma.Decimal.min(receipt.value, remaining)
        if (receipt.type === "credito_utilizado") {
          await tx.guestProfile.update({ where: { cpf: reservation.cpf }, data: { creditValue: { increment: value } } })
          await recordLedger(tx, actor, `Crédito devolvido ${reservation.id}`, value, "credito_concedido", undefined, undefined, { originType: "reservation-credit-refund", originId: reservation.id, reversalOfId: receipt.id })
        } else {
          const previous = await tx.transaction.aggregate({ where: { reversalOfId: receipt.id }, _sum: { value: true } })
          const available = receipt.value.minus(previous._sum.value ?? 0)
          const refund = Prisma.Decimal.min(available, remaining)
          if (refund.lte(0)) continue
          await recordLedger(tx, actor, `Reembolso hospedagem ${reservation.id}`, refund, "estorno", receipt.paymentMethod ?? undefined, receipt.accountId ?? undefined, { originType: "reservation-refund", originId: reservation.id, reversalOfId: receipt.id })
          remaining = remaining.minus(refund)
          continue
        }
        remaining = remaining.minus(value)
      }
      if (remaining.gt(0)) throw new HttpError(409, "Recebimentos não conciliados; revise antes do cancelamento")
    }
    await tx.reservation.update({ where: { id: reservation.id }, data: { status: input.status, cancelTreatment: treatment, cancellationFee: fee, cancellationReason: input.cancellationReason ?? null, cancellationFinancialReason: input.financialReason ?? null, cancellationReceivedValue: reservation.paidValue, refundedValue: treatment === "credito" ? 0 : remainder, retainedValue: fee, cancelledAt: new Date(), cancelledBy: actor.username, recordVersion: { increment: 1 } } })
    if (input.status === "noshow") await tx.guestProfile.update({ where: { cpf: reservation.cpf }, data: { noShows: { increment: 1 } } })
    await audit(tx, actor, `Reserva ${input.status}: ${treatment}`, reservation.id, { entityType: "reservations", entityId: reservation.id, operation: "update", metadata: { cancellationReason: input.cancellationReason, financialReason: input.financialReason, received: Number(reservation.paidValue), returned: treatment === "credito" ? 0 : Number(remainder), retained: fee, credit: treatment === "credito" ? Number(remainder) : 0 } })
    return { success: true }
  }
  if (kind === "receive-account" || kind === "receive-batch") {
    const target=z.object({accountReceivableId:id,recordVersion:z.number().int().nonnegative().optional(),installmentId:id.optional(),value:positiveMoney.optional()}).strict()
    if(kind==='receive-account') {
      const input=target.extend(paymentFields).strict().parse(payload)
      return receiveTargets(tx,actor,[input],input)
    }
    const input=z.object({targets:z.array(target.extend({value:positiveMoney,recordVersion:z.number().int().nonnegative()})).min(1).max(30),...paymentFields}).strict().parse(payload)
    return receiveTargets(tx,actor,input.targets,input)
  }
  if(kind==='pay-expense') {
    const input=z.object({expenseId:id,recordVersion:z.number().int().nonnegative().optional(),installmentId:id.optional(),value:positiveMoney.optional(),...paymentFields}).strict().parse(payload)
    return payExpense(tx,actor,input)
  }
  if(kind==='cash-movement') {
    demand(actor,'cash.move')
    const input=z.object({direction:z.enum(['supply','withdraw']),value:positiveMoney,accountId:id,reason:z.string().trim().min(5).max(500)}).strict().parse(payload)
    const batchId=randomUUID(),incoming=input.direction==='supply'
    await recordLedger(tx,actor,`Caixa ${input.reason}`,D(input.value),incoming?'transferencia_saida':'transferencia_entrada','pix',input.accountId,{batchId,originType:'cash-movement',originId:batchId})
    await recordLedger(tx,actor,`Caixa ${input.reason}`,D(input.value),incoming?'transferencia_entrada':'transferencia_saida','dinheiro',undefined,{batchId,originType:'cash-movement',originId:batchId})
    await audit(tx,actor,incoming?'Suprimento de caixa':'Sangria de caixa',batchId,{entityType:'cashCloses',operation:'action',metadata:input})
    return {success:true,batchId}
  }
  if(kind==='check-transaction') {
    demand(actor,'transactions.check')
    const input=z.object({transactionId:id,checked:z.boolean(),note:z.string().trim().min(5).max(500)}).strict().parse(payload)
    const current=await tx.transaction.findUniqueOrThrow({where:{id:input.transactionId}})
    if(!current.accountId)throw new HttpError(409,'Conferência bancária exige movimento de conta')
    await tx.transaction.update({where:{id:current.id},data:{checkedAt:input.checked?new Date():null,checkedBy:input.checked?actor.username:null,checkNote:input.note}})
    await audit(tx,actor,'Movimento bancário conferido',current.id,{entityType:'transactions',entityId:current.id,operation:'update',metadata:input})
    return {success:true}
  }
  if (kind === "bank-transfer") {
    demand(actor, "bankAccounts.transfer")
    const input = z.object({ fromAccountId: id, toAccountId: id, value: positiveMoney, description: id }).strict().parse(payload)
    if (input.fromAccountId === input.toAccountId) throw new HttpError(400, "Escolha contas diferentes")
    const transferId = randomUUID()
    await recordLedger(tx, actor, `Transferência ${transferId}`, D(input.value), "transferencia_saida", "pix", input.fromAccountId)
    await recordLedger(tx, actor, `Transferência ${transferId}`, D(input.value), "transferencia_entrada", "pix", input.toAccountId)
    const transfer = await tx.bankTransfer.create({ data: { ...input, id: transferId, date: new Date(), responsible: actor.username } })
    await audit(tx, actor, "Transferência bancária", transferId, { entityType: "bankTransfers", entityId: transferId, operation: "create" })
    return collectionMapper("bankTransfers").toApp(transfer)
  }
  return undefined
}
