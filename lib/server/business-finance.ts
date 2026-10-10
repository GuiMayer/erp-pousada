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

type Tx = Prisma.TransactionClient
const id = z.string().trim().min(1).max(200)
const money = z.number().finite().nonnegative().max(999999999).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use no máximo duas casas decimais")
const positiveMoney = money.refine(value => value > 0, "Valor deve ser positivo")
export const paymentSchema = z.enum(["dinheiro", "pix", "debito", "credito", "Dinheiro", "PIX", "Cartao Debito", "Cartao Credito", "Cartão Débito", "Cartão Crédito"])
export const paymentFields = { paymentMethod: paymentSchema, accountId: id.optional() }
const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value)

const audit = recordAudit

export async function recordLedger(tx: Tx, actor: Actor, reference: string, value: Prisma.Decimal, type = "receita", method?: string, requestedAccount?: string) {
  const paymentMethod = method ? normalizePayment(method) : undefined
  let cashSessionId: string | undefined, accountId = requestedAccount
  if (paymentMethod === "Dinheiro") {
    if (accountId) throw new HttpError(400, "Pagamento em dinheiro utiliza o caixa, não uma conta bancária")
    const session = await tx.cashClose.findFirst({ where: { status: "aberto" } })
    if (!session) throw new HttpError(409, "Abra o caixa em Financeiro antes de registrar dinheiro")
    if (type !== "receita") {
      const entries = await tx.transaction.findMany({ where: { cashSessionId: session.id } })
      const available = entries.reduce((sum, entry) => entry.type === "receita" ? sum.plus(entry.value) : sum.minus(entry.value), session.openingValue)
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
  return tx.transaction.create({ data: { id: randomUUID(), date: new Date(), description: reference, refId: reference, value, type, paymentMethod, accountId, cashSessionId, responsible: actor.username } })
}

export async function financeOperation(tx: Tx, actor: Actor, kind: string, payload: unknown): Promise<unknown | undefined> {
  if (kind === "cash-open") {
    const { openingValue } = z.object({ openingValue: money }).strict().parse(payload)
    if (await tx.cashClose.count({ where: { status: "aberto" } })) throw new HttpError(409, "Já existe um caixa aberto")
    const now = new Date()
    const session = await tx.cashClose.create({ data: { id: randomUUID(), status: "aberto", date: now, openedAt: now, operator: actor.username, responsibleUserId: actor.id, openingValue, physicalValue: 0, expectedValue: openingValue, divergence: 0 } })
    await audit(tx, actor, "Caixa aberto", session.id, { entityType: "cashCloses", entityId: session.id, operation: "create" })
    return collectionMapper("cashCloses").toApp(session)
  }
  if (kind === "cash-close") {
    const { sessionId, physicalValue } = z.object({ sessionId: id, physicalValue: money }).strict().parse(payload)
    const session = await tx.cashClose.findUniqueOrThrow({ where: { id: sessionId } })
    if (session.status !== "aberto") throw new HttpError(409, "Caixa já fechado")
    if (session.responsibleUserId !== actor.id && !can(actor, "cash.closeAny")) throw new HttpError(403, "Somente o responsável ou supervisor pode fechar este caixa")
    const entries = await tx.transaction.findMany({ where: { cashSessionId: session.id } })
    const expectedValue = entries.reduce((sum, entry) => entry.type === "receita" ? sum.plus(entry.value) : sum.minus(entry.value), session.openingValue)
    const closed = await tx.cashClose.update({ where: { id: session.id }, data: { status: "fechado", date: new Date(), closedAt: new Date(), physicalValue, expectedValue, divergence: D(physicalValue).minus(expectedValue) } })
    await audit(tx, actor, "Caixa fechado", session.id, { entityType: "cashCloses", entityId: session.id, operation: "update" })
    return collectionMapper("cashCloses").toApp(closed)
  }
  if (kind === "pay-reservation") {
    const input = z.object({ reservationId: id, recordVersion: z.number().int().nonnegative().optional(), value: positiveMoney, paymentMethod: paymentSchema.or(z.literal("credito_hospede")), accountId: id.optional() }).strict().parse(payload)
    const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: input.reservationId } })
    if (input.recordVersion !== undefined) requireVersion(input.recordVersion, reservation.recordVersion)
    if (!["confirmada", "checkin"].includes(reservation.status)) throw new HttpError(409, "Reserva não permite recebimento")
    if (D(input.value).gt(reservation.totalValue.minus(reservation.paidValue))) throw new HttpError(409, "Valor excede o saldo da hospedagem")
    const stay = await tx.stay.findUnique({ where: { reservationId: reservation.id }, include: stayInclude })
    if (stay) {
      await receiveStay(tx, actor, stay, input.value, input.paymentMethod, input.accountId, "lodging")
      return collectionMapper("reservations").toApp(await tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } }))
    }
    if (input.paymentMethod === "credito_hospede") {
      const guest = await tx.guestProfile.findUnique({ where: { cpf: reservation.cpf } })
      if (reservation.payerId && reservation.payerId !== guest?.customerId) throw new HttpError(409, "Crédito pessoal não pode quitar conta da empresa")
      const changed = await tx.guestProfile.updateMany({ where: { cpf: reservation.cpf, creditValue: { gte: input.value } }, data: { creditValue: { decrement: input.value } } })
      if (!changed.count) throw new HttpError(409, "Crédito do hóspede insuficiente")
      await recordLedger(tx, actor, `Hospedagem ${reservation.id}`, D(input.value), "credito_utilizado")
    } else await recordLedger(tx, actor, `Hospedagem ${reservation.id}`, D(input.value), "receita", input.paymentMethod, input.accountId)
    const updated = await tx.reservation.update({ where: { id: reservation.id }, data: { paidValue: { increment: input.value } } })
    await audit(tx, actor, "Hospedagem recebida", reservation.id, { entityType: "reservations", entityId: reservation.id, operation: "update" })
    return collectionMapper("reservations").toApp(updated)
  }
  if (kind === "cancel-reservation") {
    const input = z.object({ reservationId: id, status: z.enum(["cancelada", "noshow"]).default("cancelada"), treatment: z.enum(["estorno", "multa", "credito"]), fee: money.default(0) }).strict().parse(payload)
    const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: input.reservationId } })
    if (reservation.status !== "confirmada") throw new HttpError(409, "Somente reserva confirmada pode ser cancelada")
    if (input.status === "noshow" && reservation.checkIn.toISOString().slice(0, 10) > businessDay()) throw new HttpError(409, "Não registre no-show antes da chegada prevista")
    if (input.fee > 0 || input.treatment === "credito") demand(actor, "reservations.feeCredit")
    if (reservation.paidValue.gt(0)) demand(actor, "reservations.paidCancel")
    if (D(input.fee).gt(reservation.paidValue) || (input.treatment === "estorno" && input.fee !== 0)) throw new HttpError(400, "Multa não pode exceder o recebido; estorno integral não admite multa")
    const remainder = reservation.paidValue.minus(input.fee)
    if (input.treatment === "credito") {
      await tx.guestProfile.update({ where: { cpf: reservation.cpf }, data: { creditValue: { increment: remainder } } })
      await recordLedger(tx, actor, `Crédito cancelamento ${reservation.id}`, remainder, "credito_concedido")
    } else {
      let remaining = remainder
      const receipts = await tx.transaction.findMany({ where: { refId: `Hospedagem ${reservation.id}`, type: { in: ["receita", "credito_utilizado"] } }, orderBy: [{ date: "desc" }, { id: "asc" }] })
      for (const receipt of receipts) {
        if (remaining.lte(0)) break
        const value = Prisma.Decimal.min(receipt.value, remaining)
        if (receipt.type === "credito_utilizado") {
          await tx.guestProfile.update({ where: { cpf: reservation.cpf }, data: { creditValue: { increment: value } } })
          await recordLedger(tx, actor, `Crédito devolvido ${reservation.id}`, value, "credito_concedido")
        } else await recordLedger(tx, actor, `Reembolso hospedagem ${reservation.id}`, value, "estorno", receipt.paymentMethod ?? undefined, receipt.accountId ?? undefined)
        remaining = remaining.minus(value)
      }
      if (remaining.gt(0)) throw new HttpError(409, "Recebimentos não conciliados; revise antes do cancelamento")
    }
    await tx.reservation.update({ where: { id: reservation.id }, data: { status: input.status, cancelTreatment: input.treatment, cancellationFee: input.fee, paidValue: 0 } })
    if (input.status === "noshow") await tx.guestProfile.update({ where: { cpf: reservation.cpf }, data: { noShows: { increment: 1 } } })
    await audit(tx, actor, `Reserva ${input.status}: ${input.treatment}, multa ${input.fee}`, reservation.id, { entityType: "reservations", entityId: reservation.id, operation: "update" })
    return { success: true }
  }
  if (kind === "receive-account") {
    demand(actor, "accountsReceivable.receive")
    const input = z.object({ accountReceivableId: id, recordVersion: z.number().int().nonnegative().optional(), installmentId: id.optional(), value: positiveMoney.optional(), ...paymentFields }).strict().parse(payload)
    const account = await tx.accountReceivable.findUniqueOrThrow({ where: { id: input.accountReceivableId }, include: { installments: true } })
    if (input.recordVersion !== undefined) requireVersion(input.recordVersion, account.recordVersion)
    if (!["pendente", "vencido"].includes(account.status)) throw new HttpError(409, "Título já recebido ou cancelado")
    if (account.sourceStayId) {
      if (input.installmentId) throw new HttpError(400, "Cobrança de hospedagem sem parcela independente")
      const stay = await tx.stay.findUniqueOrThrow({ where: { id: account.sourceStayId }, include: stayInclude })
      await receiveStay(tx, actor, stay, input.value ?? Number(account.value.minus(account.paidValue)), input.paymentMethod, input.accountId)
      return { success: true }
    }
    if (input.value !== undefined && !account.value.equals(input.value)) throw new HttpError(400, "Recebimento parcial disponível na cobrança de hospedagem")
    let value = account.value, reference = account.id
    if (account.installments.length) {
      const part = account.installments.find(item => item.id === input.installmentId)
      if (!part || !["pendente", "vencido"].includes(part.status)) throw new HttpError(409, "Selecione uma parcela pendente")
      value = part.value; reference = part.id
      await tx.accountReceivableInstallment.update({ where: { id: part.id }, data: { status: "pago", paymentDate: new Date() } })
      if (account.installments.every(item => item.id === part.id || item.status === "pago")) await tx.accountReceivable.update({ where: { id: account.id }, data: { status: "pago", paymentDate: new Date() } })
    } else {
      if (input.installmentId) throw new HttpError(400, "Título sem parcelas")
      await tx.accountReceivable.update({ where: { id: account.id }, data: { status: "pago", paymentDate: new Date() } })
    }
    await recordLedger(tx, actor, `Recebimento ${reference}`, value, "receita", input.paymentMethod, input.accountId)
    await audit(tx, actor, "Título recebido", reference, { entityType: "accountsReceivable", entityId: account.id, operation: "update" })
    return { success: true }
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
