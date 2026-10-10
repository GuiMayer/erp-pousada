import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import type { Actor } from "./auth"
import { demand } from "./permissions"
import { HttpError } from "./http"
import { requireVersion } from "./concurrency"
import { recordAudit } from "./audit"
import { recordLedger, paymentSchema } from "./business-finance"
import { serverQuote } from "./lodging-pricing"
import { businessDay } from "@/lib/utils/business-values"
import { isCPF } from "@/lib/utils/cpf-cnpj-validator"
import { stayBalance, type Stay } from "@/lib/stays"

type Tx = Prisma.TransactionClient
const id = z.string().trim().min(1).max(200)
const reason = z.string().trim().min(5).max(500)
const money = z.number().finite().positive().max(999999999).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < .00001, "Use até duas casas decimais")
const target = { stayId: id, recordVersion: z.number().int().nonnegative() }
export const stayInclude = { occupants: true, allocations: true, charges: true, payments: true }
type Loaded = Prisma.StayGetPayload<{ include: typeof stayInclude }>
export function mapStay(row: Loaded): Stay {
  return { ...row, lodgingValue: Number(row.lodgingValue), checkIn: row.checkIn.toISOString().slice(0,10), checkOut: row.checkOut.toISOString().slice(0,10), endedAt: row.endedAt?.toISOString(), nightlyPrices: row.nightlyPrices as Stay["nightlyPrices"], allocations: row.allocations.map(a => ({ ...a, start: a.start.toISOString().slice(0,10), end: a.end.toISOString().slice(0,10) })), charges: row.charges.map(c => ({ ...c, unitPrice: Number(c.unitPrice), createdAt: c.createdAt.toISOString() })), payments: row.payments.map(p => ({ ...p, value: Number(p.value), createdAt: p.createdAt.toISOString() })) }
}
export async function ensureStay(tx: Tx, reservationId: string) {
  const current = await tx.stay.findUnique({ where: { reservationId }, include: stayInclude })
  if (current) return current
  const r = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId } })
  if (r.status !== "checkin") throw new HttpError(409, "Hospedagem não iniciada")
  const guest = await tx.guestProfile.findUnique({ where: { cpf: r.cpf } })
  return tx.stay.create({ data: { id: randomUUID(), reservationId, payerId: r.payerId ?? guest?.customerId, guestName: r.guestName, guestCount: r.guestCount, roomId: r.roomId, checkIn: r.checkIn, checkOut: r.checkOut, lodgingValue: r.totalValue, groupId: r.groupId, nightlyPrices: r.nightlyPrices ?? undefined, occupants: { create: [{ id: randomUUID(), name: r.guestName, customerId: guest?.customerId }] }, allocations: { create: [{ id: randomUUID(), roomId: r.roomId, start: r.checkIn, end: r.checkOut }] }, payments: r.paidValue.gt(0) ? { create: [{ id: randomUUID(), value: r.paidValue, bucket: "lodging", method: "sinal anterior" }] } : undefined }, include: stayInclude })
}
export async function roomStay(tx: Tx, roomId: number) {
  const active = await tx.stay.findFirst({ where: { roomId, status: "active" }, include: stayInclude })
  if (active) return active
  const r = await tx.reservation.findFirstOrThrow({ where: { roomId, status: "checkin" } })
  return ensureStay(tx, r.id)
}
async function load(tx: Tx, input: { stayId: string; recordVersion: number }, active = true) {
  const stay = await tx.stay.findUniqueOrThrow({ where: { id: input.stayId }, include: stayInclude })
  requireVersion(input.recordVersion, stay.recordVersion)
  if (active && stay.status !== "active") throw new HttpError(409, "Hospedagem encerrada")
  return stay
}
async function touched(tx: Tx, actor: Actor, stayId: string, action: string, metadata?: Record<string, unknown>) {
  await tx.stay.update({ where: { id: stayId }, data: { recordVersion: { increment: 1 } } })
  await recordAudit(tx, actor, action, stayId, { entityType: "stays", entityId: stayId, operation: "update", metadata })
}
export async function receiveStay(tx: Tx, actor: Actor, stay: Loaded, value: number, method: string, accountId?: string, bucket = "general") {
  const balances = stayBalance(mapStay(stay))
  const limit = bucket === "lodging" ? balances.lodgingBalance : bucket === "consumption" ? balances.consumptionBalance : balances.balance
  if (value <= 0 || value > limit + .000001) throw new HttpError(409, "Valor excede o saldo elegível da hospedagem")
  let transaction
  if (method === "credito_hospede") {
    const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: stay.reservationId } })
    const guest = await tx.guestProfile.findUniqueOrThrow({ where: { cpf: reservation.cpf } })
    if (stay.payerId !== guest.customerId) throw new HttpError(409, "Crédito pessoal não pode quitar conta da empresa")
    const updated = await tx.guestProfile.updateMany({ where: { cpf: guest.cpf, creditValue: { gte: value } }, data: { creditValue: { decrement: value } } })
    if (!updated.count) throw new HttpError(409, "Crédito insuficiente")
    transaction = await recordLedger(tx, actor, `Hospedagem ${stay.reservationId}`, new Prisma.Decimal(value), "credito_utilizado")
  } else transaction = await recordLedger(tx, actor, `Hospedagem ${stay.reservationId}`, new Prisma.Decimal(value), "receita", method, accountId)
  // A general receipt settles nights first, then consumption. No duplicated receipt.
  const lodging = bucket === "lodging" ? value : bucket === "consumption" ? 0 : Math.min(value, Math.max(0, balances.lodgingBalance))
  const consumptionValue = Math.round((value - lodging) * 100) / 100
  const parts = [{ bucket: "lodging", value: lodging }, { bucket: "consumption", value: consumptionValue }].filter(p => p.value > 0)
  for (let i = 0; i < parts.length; i++) await tx.stayPayment.create({ data: { id: randomUUID(), stayId: stay.id, ...parts[i], method, transactionId: i === 0 ? transaction.id : undefined } })
  if (lodging) await tx.reservation.update({ where: { id: stay.reservationId }, data: { paidValue: { increment: lodging } } })
  if (stay.status === "active" && consumptionValue >= balances.consumptionBalance && balances.consumptionBalance > 0) await tx.roomConsumption.deleteMany({ where: { roomId: stay.roomId } })
  const title = await tx.accountReceivable.findUnique({ where: { sourceStayId: stay.id } })
  if (title) {
    const paidValue = title.paidValue.plus(value)
    if (paidValue.gt(title.value)) throw new HttpError(409, "Título com saldo divergente; revise a cobrança")
    await tx.accountReceivable.update({ where: { id: title.id }, data: { paidValue, status: paidValue.equals(title.value) ? "pago" : "pendente", paymentDate: paidValue.equals(title.value) ? new Date() : null } })
  }
  await touched(tx, actor, stay.id, "Hospedagem recebida", { value, method, transactionId: transaction.id })
}
export async function finishStay(tx: Tx, actor: Actor, stay: Loaded, dueDate?: string, confirmed?: boolean) {
  if (stay.status !== "active") throw new HttpError(409, "Hospedagem já encerrada")
  const balance = stayBalance(mapStay(stay)).balance
  if (balance < 0) throw new HttpError(409, "Concilie o crédito antes da saída")
  if (balance > 0) {
    demand(actor, "hospitality.companyCredit")
    const payer = stay.payerId ? await tx.customer.findUnique({ where: { id: stay.payerId } }) : null
    if (!payer?.active || isCPF(payer.cpfCnpj) || !payer.cpfCnpj || !(payer.roles as string[]).includes("payer")) throw new HttpError(409, "Saída a prazo exige empresa ativa como pagadora")
    if (!confirmed || !dueDate || dueDate < businessDay()) throw new HttpError(400, "Confirme a cobrança empresarial e informe vencimento a partir de hoje")
    await tx.accountReceivable.create({ data: { id: randomUUID(), sourceStayId: stay.id, customerId: payer.id, customerName: payer.name, description: `Hospedagem ${stay.reservationId} · ${stay.guestName}`, value: balance, issueDate: new Date(), dueDate: new Date(dueDate), status: "pendente", category: "Hospedagem" } })
  }
  await tx.stay.update({ where: { id: stay.id }, data: { status: "closed", endedAt: new Date() } })
  await tx.reservation.update({ where: { id: stay.reservationId }, data: { status: "checkout" } })
  await tx.roomConsumption.deleteMany({ where: { roomId: stay.roomId } })
  await tx.room.update({ where: { id: stay.roomId }, data: { status: "limpeza", guest: null, guestCpf: null, checkIn: null, checkOut: null } })
  await touched(tx, actor, stay.id, "Check-out realizado", { balance, dueDate, corporate: balance > 0 })
}
export async function stayOperation(tx: Tx, actor: Actor, kind: string, payload: unknown) {
  if (kind === "stay-occupants") {
    const input = z.object({ ...target, occupants: z.array(z.object({ name: id, customerId: id.optional() }).strict()).min(1).max(100) }).strict().parse(payload)
    const stay = await load(tx, input)
    if (!stay.guestCount || input.occupants.length !== stay.guestCount) throw new HttpError(409, "Informe todos os ocupantes conforme a ocupação confirmada")
    const ids = input.occupants.map(p => p.customerId).filter(Boolean) as string[]
    if (new Set(ids).size !== ids.length) throw new HttpError(400, "Pessoa repetida entre ocupantes")
    for (const person of input.occupants) if (person.customerId) {
      const row = await tx.customer.findUniqueOrThrow({ where: { id: person.customerId } })
      if (!row.active || !isCPF(row.cpfCnpj)) throw new HttpError(409, "Ocupante cadastrado deve ser pessoa física ativa")
      person.name = row.name
    }
    await tx.stayOccupant.deleteMany({ where: { stayId: stay.id } })
    await tx.stayOccupant.createMany({ data: input.occupants.map(o => ({ ...o, id: randomUUID(), stayId: stay.id })) })
    await touched(tx, actor, stay.id, "Ocupantes atualizados", { occupants: input.occupants })
    return { success: true }
  }
  if (kind === "stay-receive") {
    const input = z.object({ ...target, value: money, paymentMethod: paymentSchema.or(z.literal("credito_hospede")), accountId: id.optional() }).strict().parse(payload)
    const stay = await load(tx, input, false)
    if (stay.status === "closed") demand(actor, "accountsReceivable.receive")
    await receiveStay(tx, actor, stay, input.value, input.paymentMethod, input.accountId)
    return { success: true }
  }
  if (kind === "stay-checkout") {
    const input = z.object({ ...target, dueDate: z.string().date().optional(), confirmed: z.boolean().optional() }).strict().parse(payload)
    await finishStay(tx, actor, await load(tx, input), input.dueDate, input.confirmed)
    return { success: true }
  }
  if (kind === "stay-transfer") {
    const input = z.object({ ...target, roomId: z.number().int().positive(), effectiveDate: z.string().date(), reason, reprice: z.boolean().default(false) }).strict().parse(payload)
    const stay = await load(tx, input)
    if (!stay.guestCount) throw new HttpError(409, "Ocupação legada desconhecida; regularize antes da troca")
    if (input.effectiveDate !== businessDay() || input.effectiveDate < stay.checkIn.toISOString().slice(0,10) || input.effectiveDate >= stay.checkOut.toISOString().slice(0,10)) throw new HttpError(400, "Troca deve começar hoje, dentro da hospedagem")
    const room = await tx.room.findUniqueOrThrow({ where: { id: input.roomId } })
    if (await tx.roomConsumption.count({ where: { roomId: room.id } })) throw new HttpError(409, "Destino possui consumo legado; regularize antes da troca")
    if (room.id === stay.roomId || room.status !== "disponivel" || !room.capacity || room.capacity < stay.guestCount) throw new HttpError(409, "Destino indisponível ou com capacidade insuficiente")
    const start = new Date(input.effectiveDate)
    if (await tx.reservation.count({ where: { id: { not: stay.reservationId }, roomId: room.id, status: { in: ["confirmada", "checkin"] }, checkIn: { lt: stay.checkOut }, checkOut: { gt: start } } })) throw new HttpError(409, "Destino possui reserva no período")
    let nightlyPrices = stay.nightlyPrices, lodgingValue = stay.lodgingValue
    if (input.reprice) {
      const quote = await serverQuote(tx, { roomId: room.id, guestCount: stay.guestCount, checkIn: input.effectiveDate, checkOut: stay.checkOut.toISOString().slice(0,10) })
      const previous = stay.nightlyPrices as Stay["nightlyPrices"]
      if (!previous?.length) throw new HttpError(409, "Preço legado sem composição; preserve o valor acordado")
      const nights = [...previous.filter(n => n.date < input.effectiveDate), ...quote.nights]
      lodgingValue = new Prisma.Decimal(nights.reduce((s,n) => s + Math.round(n.total * 100), 0)).div(100)
      const paid = stayBalance(mapStay(stay)).paid
      if (lodgingValue.lt(stay.lodgingValue)) demand(actor, "lodgingTariffs.override")
      if (lodgingValue.plus(stayBalance(mapStay(stay)).consumption).lt(paid)) throw new HttpError(409, "Novo preço inferior ao recebido; concilie antes")
      nightlyPrices = nights as unknown as Prisma.JsonValue
    }
    await tx.stayAllocation.updateMany({ where: { stayId: stay.id, end: { gt: start } }, data: { end: start } })
    await tx.stayAllocation.create({ data: { id: randomUUID(), stayId: stay.id, roomId: room.id, start, end: stay.checkOut, reason: input.reason } })
    const old = await tx.room.findUniqueOrThrow({ where: { id: stay.roomId } })
    await tx.room.update({ where: { id: stay.roomId }, data: { status: "limpeza", guest: null, guestCpf: null, checkIn: null, checkOut: null } })
    await tx.room.update({ where: { id: room.id }, data: { status: "ocupado", guest: old.guest, guestCpf: old.guestCpf, checkIn: start, checkOut: stay.checkOut } })
    await tx.roomConsumption.updateMany({ where: { roomId: stay.roomId }, data: { roomId: room.id } })
    await tx.reservation.update({ where: { id: stay.reservationId }, data: { roomId: room.id, roomNumber: room.number, checkIn: start, totalValue: lodgingValue, nightlyPrices: nightlyPrices ?? undefined } })
    await tx.stay.update({ where: { id: stay.id }, data: { roomId: room.id, lodgingValue, nightlyPrices: nightlyPrices ?? undefined } })
    await touched(tx, actor, stay.id, "Quarto trocado", { from: stay.roomId, to: room.id, ...input })
    return { success: true }
  }
  return undefined
}
