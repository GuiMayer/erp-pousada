import { z } from "zod"
import type { DataStore, IStorageAdapter } from "./types"
import { createDataStore } from "./repositories"
import { cancellationAmounts, cancellationReason, checkinDateError, noShowEligible } from "@/lib/booking-flow"
import { businessDay, normalizePayment } from "@/lib/utils/business-values"
import { isCPF, normalizeDocument } from "@/lib/utils/cpf-cnpj-validator"
import { quoteLodging, type NightlyPrice } from "@/lib/lodging-pricing"
import { cashIncoming, distributePayment, type PaymentLine } from "@/lib/payments"
import type { Reservation, Transaction } from "@/lib/store"
import type { Stay } from "@/lib/stays"

export const demoBookingKinds = ["reserve-group", "edit-reservation", "check-in", "record-completed-stay", "cancel-reservation", "pay-reservation"]
const money = z.number().finite().nonnegative().max(999999999).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < .00001)
const base = z.object({ roomId: z.number().int().positive(), guestCount: z.number().int().min(1).max(100), totalValue: money, priceExceptionReason: z.string().trim().min(5).max(500).optional() })
const entry = base.extend({ cpf: z.string().transform(normalizeDocument).refine(isCPF), guestName: z.string().trim().min(1), payerId: z.string().min(1), checkIn: z.string().date(), checkOut: z.string().date() })
const cents = (n: number) => Math.round(n * 100)
const decimal = (n: number) => Math.round(n) / 100
let queue: Promise<unknown> = Promise.resolve()

/** Staging keeps failed demo commands from leaving half an entry or a receipt behind. */
export function demoBookingOperation(store: DataStore, kind: string, payload: unknown, can: (p: string) => boolean, username: string) {
  const execute = async () => {
    const snapshot = await store.exportAll()
    let state: Record<string, unknown> = JSON.parse(snapshot)
    const adapter: IStorageAdapter = {
      get: async <T,>(key: string) => structuredClone(state[key] ?? null) as T | null,
      set: async (key, value) => { state[key] = structuredClone(value) },
      remove: async key => { delete state[key] }, clear: async () => { state = {} }, keys: async () => Object.keys(state),
      export: async () => JSON.stringify(state), import: async json => { state = JSON.parse(json) }, getUsage: async () => 0,
    }
    const staged = createDataStore({ adapter })
    const result = await apply(staged, kind, payload, can, username)
    try { await store.importAll(await staged.exportAll()) }
    catch (error) { await store.importAll(snapshot); throw error }
    for (const repository of Object.values(store)) {
      if (repository && typeof repository === "object" && "invalidateCache" in repository && typeof repository.invalidateCache === "function") repository.invalidateCache()
    }
    return result
  }
  const next = queue.then(() => typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("erp-demo-booking", execute) : execute())
  queue = next.catch(() => {})
  return next
}

async function apply(store: DataStore, kind: string, payload: unknown, can: (p: string) => boolean, username: string): Promise<unknown> {
  const demand = (p: string) => { if (!can(p)) throw Error("Você não tem permissão para esta ação") }
  demand(["reserve-group", "create-reservation"].includes(kind) ? "reservations.create" : kind === "edit-reservation" ? "reservations.edit" : kind === "cancel-reservation" ? "reservations.cancel" : kind === "pay-reservation" ? "hospitality.receive" : "hospitality.checkin")
  const today = businessDay(), now = new Date().toISOString()
  const audit = (reference: string, metadata: Record<string, unknown>) => store.auditLog.create({ date: now, user: username, action: kind, reference, entityType: "reservations", entityId: reference, operation: "action", metadata })
  const version = (r: Reservation, value: unknown) => { if (value !== (r.recordVersion ?? 0)) throw Error("Reserva alterada; reabra o atendimento antes de confirmar") }
  async function ledger(r: Reservation, value: number, method: string, accountId?: string, original?: Transaction) {
    const normalized = normalizePayment(method), refund = !!original
    let cashSessionId: string | undefined
    if (normalized === "Dinheiro") {
      const session = (await store.cashCloses.getAll()).find(s => s.status === "aberto")
      if (!session) throw Error("Abra o caixa antes de registrar dinheiro")
      cashSessionId = session.id
      const cash = cents(session.openingValue ?? 0) + (await store.transactions.getAll()).filter(t => t.cashSessionId === session.id).reduce((v, t) => v + cents(Math.abs(t.value)) * (cashIncoming(t.type) ? 1 : -1), 0)
      if (refund && cash < cents(value)) throw Error("Saldo de caixa insuficiente para devolver")
    } else {
      const accounts = (await store.bankAccounts.getAll()).filter(a => a.active)
      const account = accounts.find(a => a.id === accountId) ?? (!accountId && accounts.length === 1 ? accounts[0] : undefined)
      if (!account) throw Error("Selecione uma conta bancária ativa")
      if (refund && cents(account.currentBalance) < cents(value)) throw Error("Saldo bancário insuficiente para devolver")
      accountId = account.id
      await store.bankAccounts.update(account.id, { currentBalance: decimal(cents(account.currentBalance) + cents(value) * (refund ? -1 : 1)) })
    }
    return store.transactions.create({ date: now, description: `${refund ? "Reembolso hospedagem" : "Hospedagem"} ${r.id}`, refId: `Hospedagem ${r.id}`, value, type: refund ? "estorno" : "receita", paymentMethod: normalized, accountId, cashSessionId, responsible: username, originType: refund ? "reservation-refund" : "reservation", originId: r.id, reversalOfId: original?.id })
  }
  async function receive(ids: string[], raw: unknown) {
    if (!raw) return
    demand("hospitality.receive")
    const payment = z.object({ value: money.refine(v => v > 0), payments: z.array(z.object({ method: z.string(), value: money, accountId: z.string().optional() })).min(1).max(8) }).parse(raw)
    const all = (await store.reservations.getAll()).filter(r => ids.includes(r.id))
    if (cents(payment.value) > all.reduce((sum, r) => sum + cents(r.totalValue) - cents(r.paidValue ?? 0), 0)) throw Error("Recebimento excede o saldo")
    const pool = distributePayment(payment.value, payment.payments).lines.map(p => ({ ...p, remaining: cents(p.applied) }))
    let remaining = cents(payment.value)
    for (const r of all) {
      const value = Math.min(remaining, cents(r.totalValue) - cents(r.paidValue ?? 0)); let allocation = value
      for (const p of pool) {
        const chunk = Math.min(allocation, p.remaining)
        if (chunk > 0) {
          const transaction = await ledger(r, decimal(chunk), p.method, p.accountId)
          const stay = (await store.stays.getAll()).find(s => s.reservationId === r.id && s.status === "active")
          if (stay) await store.stays.update(stay.id, { payments: [...stay.payments, { id: crypto.randomUUID(), value: decimal(chunk), bucket: "lodging", method: p.method, createdAt: now, transactionId: transaction.id }], recordVersion: stay.recordVersion + 1 })
        }
        p.remaining -= chunk; allocation -= chunk
      }
      await store.reservations.update(r.id, { paidValue: decimal(cents(r.paidValue ?? 0) + value), recordVersion: (r.recordVersion ?? 0) + 1 })
      remaining -= value
    }
  }
  if (kind === "pay-reservation") {
    const input = z.object({ reservationId: z.string(), recordVersion: z.number().int().optional(), value: money.refine(v => v > 0), payments: z.array(z.object({ method: z.string(), value: money, accountId: z.string().optional() })).optional(), paymentMethod: z.string().optional(), accountId: z.string().optional() }).parse(payload)
    const r = await store.reservations.getById(input.reservationId)
    if (!r || !["confirmada", "checkin"].includes(r.status)) throw Error("Reserva não permite recebimento")
    version(r, input.recordVersion ?? 0)
    if (cents(input.value) > cents(r.totalValue) - cents(r.paidValue ?? 0)) throw Error("Recebimento excede o saldo")
    if (input.paymentMethod === "credito_hospede") {
      const guest = await store.guests.getById(r.cpf)
      if (!guest || guest.customerId !== r.payerId || cents(guest.creditValue ?? 0) < cents(input.value) || input.payments?.length) throw Error("Crédito pessoal indisponível para esta cobrança")
      await store.guests.update(r.cpf, { creditValue: decimal(cents(guest.creditValue ?? 0) - cents(input.value)) })
      const transaction = await store.transactions.create({ date: now, description: `Hospedagem ${r.id}`, refId: `Hospedagem ${r.id}`, value: input.value, type: "credito_utilizado", responsible: username })
      await store.reservations.update(r.id, { paidValue: decimal(cents(r.paidValue ?? 0) + cents(input.value)), recordVersion: (r.recordVersion ?? 0) + 1 })
      const stay = (await store.stays.getAll()).find(s => s.reservationId === r.id && s.status === "active")
      if (stay) await store.stays.update(stay.id, { payments: [...stay.payments, { id: crypto.randomUUID(), value: input.value, bucket: "lodging", method: "credito_hospede", transactionId: transaction.id, createdAt: now }], recordVersion: stay.recordVersion + 1 })
    } else await receive([r.id], { value: input.value, payments: input.payments ?? [{ method: input.paymentMethod, value: input.value, accountId: input.accountId }] })
    await audit(r.id, { value: input.value })
    return store.reservations.getById(r.id)
  }
  if (kind === "cancel-reservation") {
    const input = z.object({ reservationId: z.string(), recordVersion: z.number().int().optional(), status: z.enum(["cancelada", "noshow"]), decision: z.enum(["refund", "retain", "credit"]), refundValue: money.optional(), cancellationReason, financialReason: z.string().trim().min(5).max(500).optional() }).parse(payload)
    const r = await store.reservations.getById(input.reservationId)
    if (!r || r.status !== "confirmada") throw Error("Somente reserva confirmada pode ser cancelada")
    version(r, input.recordVersion ?? 0)
    const settings = (await store.systemSettings.getAll())[0]
    if (input.status === "noshow" && !noShowEligible(r.checkIn, settings?.checkInTime ?? "14:00")) throw Error("Aguarde a chegada prevista e o horário configurado")
    const received = r.paidValue ?? 0
    if (received > 0) demand("reservations.paidCancel")
    const amounts = cancellationAmounts(received, input.decision, input.refundValue)
    if (amounts.retained > 0 || amounts.credit > 0) { demand("reservations.feeCredit"); if (!input.financialReason) throw Error("Informe a justificativa financeira") }
    const guest = await store.guests.getById(r.cpf)
    if (amounts.credit > 0) {
      if (!guest || guest.customerId !== r.payerId) throw Error("Crédito pessoal exige que o hóspede seja o pagador")
      await store.guests.update(r.cpf, { creditValue: decimal(cents(guest.creditValue ?? 0) + cents(amounts.credit)) })
      await store.transactions.create({ date: now, description: `Crédito cancelamento ${r.id}`, refId: r.id, value: amounts.credit, type: "credito_concedido", responsible: username })
    }
    let remaining = cents(amounts.refund)
    const transactions = await store.transactions.getAll()
    for (const t of transactions.filter(t => t.refId === `Hospedagem ${r.id}` && ["receita", "credito_utilizado"].includes(t.type)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))) {
      const available = cents(t.value) - transactions.filter(p => p.reversalOfId === t.id).reduce((v, p) => v + cents(p.value), 0)
      const value = Math.min(remaining, available)
      if (value <= 0) continue
      if (t.type === "credito_utilizado") {
        if (!guest) throw Error("Titular do crédito indisponível")
        const current = await store.guests.getById(r.cpf)
        await store.guests.update(r.cpf, { creditValue: decimal(cents(current?.creditValue ?? 0) + value) })
        await store.transactions.create({ date: now, description: `Crédito devolvido ${r.id}`, value: decimal(value), type: "credito_concedido", reversalOfId: t.id, responsible: username })
      } else await ledger(r, decimal(value), t.paymentMethod ?? "", t.accountId, t)
      remaining -= value
    }
    if (remaining > 0) throw Error("Recebimentos não conciliados; revise antes de cancelar")
    await store.reservations.update(r.id, { status: input.status, cancelTreatment: input.decision === "credit" ? "credito" : amounts.retained > 0 ? "multa" : "estorno", cancellationFee: amounts.retained, cancellationReason: input.cancellationReason, cancellationFinancialReason: input.financialReason, cancellationReceivedValue: received, refundedValue: amounts.refund, retainedValue: amounts.retained, cancelledAt: now, cancelledBy: username, recordVersion: (r.recordVersion ?? 0) + 1 })
    if (input.status === "noshow" && guest) await store.guests.update(r.cpf, { noShows: guest.noShows + 1 })
    await audit(r.id, { ...amounts, cancellationReason: input.cancellationReason, financialReason: input.financialReason })
    return { success: true }
  }
  const raw = z.record(z.unknown()).parse(payload)
  if (kind === "reserve-group") {
    const inputs = z.array(base).min(1).max(50).parse(raw.rooms)
    if (new Set(inputs.map(i => i.roomId)).size !== inputs.length) throw Error("Selecione quartos distintos")
    const ids: string[] = [], groupId = crypto.randomUUID()
    for (const item of inputs) { const r = await apply(store, "create-reservation", { ...raw, ...item }, can, username) as Reservation; await store.reservations.update(r.id, { groupId }); ids.push(r.id) }
    await receive(ids, raw.initialPayment)
    return ids
  }
  const input = entry.parse(raw)
  const completed = kind === "record-completed-stay", checkin = kind === "check-in" || completed
  if (!completed && raw.actualCheckOut !== undefined) throw Error("Saida efetiva exige hospedagem ja encerrada")
  const departure = completed && raw.actualCheckOut !== undefined ? z.string().date().parse(raw.actualCheckOut) : input.checkOut
  if (checkin) {
    const error = checkinDateError(input.checkIn, departure, completed)
    if (error) throw Error(error)
    if (input.checkIn < today || completed) { demand("hospitality.checkin.backdate"); z.string().trim().min(5).max(500).parse(raw.reason) }
    if (completed) demand("hospitality.checkout")
  }
  if (departure <= input.checkIn) throw Error("Período inválido")
  const current = raw.reservationId || raw.id ? await store.reservations.getById(String(raw.reservationId ?? raw.id)) : null
  if (current) { version(current, raw.recordVersion ?? 0); if (current.status !== "confirmada") throw Error("Reserva já atendida ou cancelada") }
  if (kind === "edit-reservation" && !current) throw Error("Reserva não encontrada")
  if (current && (current.paidValue ?? 0) > 0 && (current.cpf !== input.cpf || current.payerId !== input.payerId)) throw Error("Reserva paga protege titular e pagador")
  if (current && cents(input.totalValue) < cents(current.paidValue ?? 0)) throw Error("Valor inferior ao recebido")
  const person = (await store.customers.getAll()).find(p => normalizeDocument(p.cpfCnpj) === input.cpf && p.active)
  if (!person) throw Error("Selecione ou cadastre uma pessoa ativa")
  const payer = await store.customers.getById(input.payerId)
  if (!payer?.active || !payer.roles?.includes("payer")) throw Error("Selecione um pagador ativo")
  if ((!current || current.payerId !== input.payerId) && input.payerId !== person.id && input.payerId !== person.companyId) throw Error("Pagador deve ser o hóspede ou sua empresa vinculada")
  const room = await store.rooms.getById(input.roomId)
  if (!room?.capacity || input.guestCount > room.capacity) throw Error("Respeite a capacidade do quarto")
  if (checkin && !completed && room.status !== "disponivel") throw Error("Quarto indisponível")
  if (!completed && room.status === "bloqueado" && (!room.blockEndDate || input.checkIn <= room.blockEndDate)) throw Error("Quarto bloqueado no período")
  if ((await store.reservations.getAll()).some(r => r.id !== current?.id && r.roomId === room.id && r.status === "confirmada" && r.checkIn < departure && r.checkOut > input.checkIn) || (await store.stays.getAll()).some(s => s.reservationId !== current?.id && s.allocations.some(a => a.roomId === room.id && a.start < departure && a.end > input.checkIn))) throw Error("Período conflita com reserva ou hospedagem")
  const same = current && current.roomId === input.roomId && current.guestCount === input.guestCount && current.checkIn === input.checkIn && current.checkOut === input.checkOut && cents(current.totalValue) === cents(input.totalValue)
  let nights = current?.nightlyPrices
  if (checkin && current) {
    demand("reservations.read")
    if (current.checkIn > today || input.checkIn < current.checkIn || current.roomId !== input.roomId || current.cpf !== input.cpf || current.checkOut !== input.checkOut || current.payerId !== input.payerId || current.guestCount !== input.guestCount || cents(current.totalValue) !== cents(input.totalValue)) throw Error("Edite as condições da reserva antes da entrada")
    if ((input.checkIn !== current.checkIn || departure !== current.checkOut) && raw.keepAgreedPrice !== true) throw Error("Confirme o valor acordado")
  } else if (!same) {
    if (input.priceExceptionReason) { demand("lodgingTariffs.override"); nights = spreadNights(input.checkIn, departure, input.totalValue, input.guestCount) }
    else { const quote = quoteLodging(room, await store.lodgingTariffs.getAll(), {roomId:input.roomId, guestCount:input.guestCount, checkIn:input.checkIn, checkOut:departure}); if (cents(quote.total) !== cents(input.totalValue)) throw Error("Tarifa alterada; recalcule"); nights = quote.nights }
  }
  if (current && input.totalValue < current.totalValue) {
    const settings = (await store.systemSettings.getAll())[0]
    const original = current.originalValue ?? current.totalValue
    if (original > 0 && (1 - input.totalValue / original) * 100 > (settings?.discountCeiling ?? 0)) demand("discount.override")
  }
  const data = { ...input, checkOut: current ? input.checkOut : departure, guestName: person.name, roomNumber: room.number, nightlyPrices: nights, status: checkin ? "checkin" as const : "confirmada" as const, originalValue: Math.max(current?.originalValue ?? 0, input.totalValue), recordVersion: (current?.recordVersion ?? 0) + 1 }
  const reservation = current ? await store.reservations.update(current.id, checkin ? { status: "checkin", recordVersion: (current.recordVersion ?? 0) + 1 } : data) : await store.reservations.create(data)
  if (checkin) {
    const actualNights = current && (current.checkIn !== input.checkIn || current.checkOut !== departure) ? spreadNights(input.checkIn, departure, input.totalValue, input.guestCount) : nights
    const stay = await store.stays.create({ reservationId: reservation.id, roomId: room.id, guestName: person.name, payerId: input.payerId, guestCount: input.guestCount, checkIn: input.checkIn, checkOut: departure, recordedAt: now, arrivalReason: typeof raw.reason === "string" ? raw.reason.trim() : undefined, status: "active", lodgingValue: input.totalValue, nightlyPrices: actualNights, recordVersion: 0, groupId: reservation.groupId, occupants: [{ id: crypto.randomUUID(), name: person.name, customerId: person.id }], allocations: [{ id: crypto.randomUUID(), roomId: room.id, start: input.checkIn, end: departure }], charges: [], payments: [] })
    let guest = await store.guests.getById(input.cpf)
    if (!guest) guest = await store.guests.create({ cpf: input.cpf, customerId: person.id, name: person.name, totalStays: 0, avgTicket: 0, noShows: 0 })
    await store.guests.update(input.cpf, { totalStays: guest.totalStays + 1 })
    await receive([reservation.id], raw.initialPayment)
    const received = (await store.reservations.getById(reservation.id))!.paidValue ?? 0
    const receipts = (await store.transactions.getAll()).filter(t => t.refId === `Hospedagem ${reservation.id}` && ["receita", "credito_utilizado"].includes(t.type))
    const payments: Stay["payments"] = receipts.map(t => ({ id: crypto.randomUUID(), value: t.value, bucket: "lodging", method: t.paymentMethod ?? "credito_hospede", createdAt: t.date, transactionId: t.id }))
    if (completed && cents(received) < cents(reservation.totalValue)) {
      demand("hospitality.companyCredit")
      const dueDate = z.string().date().parse(raw.dueDate)
      if (isCPF(payer.cpfCnpj) || raw.companyCreditConfirmed !== true || dueDate < today) throw Error("Confirme a cobrança a prazo da empresa e o vencimento")
      await store.accountsReceivable.create({ sourceStayId: stay.id, customerId: payer.id, customerName: payer.name, description: `Hospedagem ${reservation.id}`, value: decimal(cents(reservation.totalValue) - cents(received)), paidValue: 0, issueDate: today, dueDate, status: "pendente" })
    }
    await store.stays.update(stay.id, { payments, status: completed ? "closed" : "active", endedAt: completed ? departure + "T12:00:00Z" : undefined })
    if (completed) await store.reservations.update(reservation.id, { status: "checkout" })
    else await store.rooms.update(room.id, { status: "ocupado", guest: person.name, guestCpf: input.cpf, checkIn: input.checkIn, checkOut: input.checkOut, checkOutTime: (await store.systemSettings.getAll())[0]?.checkOutTime ?? "12:00", recordVersion: (room.recordVersion ?? 0) + 1 })
  }
  await audit(reservation.id, { actualArrival: input.checkIn, expectedArrival: current?.checkIn, actualDeparture: completed ? departure : undefined, expectedDeparture: current?.checkOut, reason: raw.reason, recordedAt: now, completed })
  return store.reservations.getById(reservation.id)
}

export function spreadNights(start: string, end: string, total: number, guests: number): NightlyPrice[] {
  const days = (Date.parse(end) - Date.parse(start)) / 86400000
  if (!Number.isInteger(days) || days < 1 || days > 366) throw Error("Período inválido ou superior a 366 noites")
  const each = Math.floor(cents(total) / days)
  return Array.from({ length: days }, (_, i) => ({ date: new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10), guests, total: decimal(each + (i < cents(total) % days ? 1 : 0)), pricePerPerson: decimal(each + (i < cents(total) % days ? 1 : 0)) / guests, tariffName: "Valor acordado" }))
}
