import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { isCPF, normalizeDocument } from "@/lib/utils/cpf-cnpj-validator"
import { businessDay } from "@/lib/utils/business-values"
import { checkinDateError } from "@/lib/booking-flow"
import type { NightlyPrice } from "@/lib/lodging-pricing"
import { ensureGuest, assertLodgingPayer } from "./contacts"
import { ensureStay, finishStay, stayInclude } from "./stays"
import { recordAudit } from "./audit"
import { demand } from "./permissions"
import { requireVersion } from "./concurrency"
import { HttpError } from "./http"
import type { Actor } from "./auth"
import { agreedPrice } from "./lodging-pricing"
import { initialPaymentSchema, receiveBookingDeposit } from "./booking-payments"

const id = z.string().trim().min(1).max(200)
export const bookingEntryInput = z.object({
  reservationId: id.optional(), recordVersion: z.number().int().nonnegative().optional(),
  roomId: z.number().int().positive(), cpf: z.string().transform(normalizeDocument).refine(isCPF, "CPF inválido"), guestName: id,
  checkIn: z.string().date(), checkOut: z.string().date(), guestCount: z.number().int().min(1).max(100).optional(), payerId: id.optional(),
  actualCheckOut: z.string().date().optional(),
  totalValue: z.number().finite().nonnegative().max(999999999).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < .00001),
  priceExceptionReason: z.string().trim().min(5).max(500).optional(),
  reason: z.string().trim().min(5).max(500).optional(), keepAgreedPrice: z.boolean().optional(),
  initialPayment: initialPaymentSchema.optional(), dueDate: z.string().date().optional(), companyCreditConfirmed: z.boolean().optional(),
}).strict()

function agreedArrivalPrices(start: string, end: string, total: number, guests: number): NightlyPrice[] {
  const days = (Date.parse(end) - Date.parse(start)) / 86400000
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new HttpError(400, "Período inválido ou superior a 366 noites")
  const cents = Math.round(total * 100), each = Math.floor(cents / days)
  return Array.from({ length: days }, (_, index) => {
    const value = (each + (index < cents % days ? 1 : 0)) / 100
    return { date: new Date(Date.parse(start) + index * 86400000).toISOString().slice(0, 10), guests, total: value, pricePerPerson: value / guests, tariffName: "Valor confirmado da reserva · chegada efetiva" }
  })
}

export async function bookingEntry(tx: Prisma.TransactionClient, actor: Actor, kind: string, payload: unknown) {
  const completed = kind === "record-completed-stay"
  const input = bookingEntryInput.parse(payload), today = businessDay()
  if (!completed && input.actualCheckOut !== undefined) throw new HttpError(400, "Saída efetiva só pode ser informada no registro de hospedagem já encerrada")
  const departure = completed ? input.actualCheckOut ?? input.checkOut : input.checkOut
  const error = checkinDateError(input.checkIn, departure, completed, today)
  if (error) throw new HttpError(400, error)
  if (input.checkIn < today || completed) {
    demand(actor, "hospitality.checkin.backdate")
    if (!input.reason) throw new HttpError(400, "Informe o motivo do lançamento retroativo")
  }
  if (completed) demand(actor, "hospitality.checkout")
  const room = await tx.room.findUniqueOrThrow({ where: { id: input.roomId } })
  if (!completed && room.status !== "disponivel") throw new HttpError(409, "Quarto indisponível")
  if (!completed && await tx.roomConsumption.count({ where: { roomId: room.id } })) throw new HttpError(409, "Revise os consumos sem hospedagem antes de ocupar o quarto")
  const start = new Date(input.checkIn), end = new Date(departure)
  if (!completed && room.status === "bloqueado") throw new HttpError(409, "Quarto bloqueado")
  const existing = input.reservationId ? await tx.reservation.findUniqueOrThrow({ where: { id: input.reservationId } }) : undefined
  if (input.reservationId) requireVersion(input.recordVersion, existing!.recordVersion)
  if (existing) {
    demand(actor, "reservations.read")
    const identity = await tx.guestProfile.findUnique({where:{cpf:existing.cpf},include:{customer:true}})
    if (existing.status !== "confirmada" || existing.roomId !== room.id || existing.cpf !== input.cpf && identity?.customer?.cpfCnpj !== input.cpf || existing.checkOut.toISOString().slice(0, 10) !== input.checkOut) throw new HttpError(409, "A reserva mudou. Revise os dados antes da entrada")
    if (existing.checkIn.toISOString().slice(0, 10) > today) throw new HttpError(409, "A reserva prevê entrada futura. Edite o período antes de antecipar a chegada")
    if (input.checkIn < existing.checkIn.toISOString().slice(0, 10)) throw new HttpError(409, "Edite a reserva antes de antecipar a chegada prevista")
    if (!existing.totalValue.equals(input.totalValue) || input.guestCount !== existing.guestCount || input.payerId !== existing.payerId) throw new HttpError(409, "Edite a reserva para alterar preço, ocupação ou pagador")
    if ((start.getTime() !== existing.checkIn.getTime() || end.getTime() !== existing.checkOut.getTime()) && !input.keepAgreedPrice) throw new HttpError(409, "Confirme a manutenção do valor acordado ou edite a reserva para recalcular")
  }
  if (await tx.reservation.count({ where: { ...(existing ? { id: { not: existing.id } } : {}), roomId: room.id, status: "confirmada", checkIn: { lt: end }, checkOut: { gt: start } } }) ||
      await tx.stayAllocation.count({ where: { roomId: room.id, start: { lt: end }, end: { gt: start } } })) throw new HttpError(409, "Período conflita com reserva ou hospedagem já registrada")
  if (!input.guestCount || !room.capacity || input.guestCount > room.capacity) throw new HttpError(400, "Informe a ocupação e respeite a capacidade do quarto")
  const guest = await ensureGuest(tx, actor, input.cpf, input.guestName)
  const payerId = existing?.payerId ?? input.payerId ?? guest.customerId!
  const payer = await tx.customer.findUnique({ where: { id: payerId } })
  if (!payer?.active || !(payer.roles as string[]).includes("payer")) throw new HttpError(409, "Selecione um pagador ativo")
  await assertLodgingPayer(tx, guest, payerId, existing)
  const prices = existing ? existing.nightlyPrices ?? undefined : await agreedPrice(tx, actor, { ...input, checkOut: departure })
  const reservation = existing ? await tx.reservation.update({ where: { id: existing.id }, data: { status: "checkin", recordVersion: { increment: 1 } } }) :
    await tx.reservation.create({ data: { id: randomUUID(), roomId: room.id, roomNumber: room.number, cpf: guest.cpf, guestName: guest.name, guestCount: input.guestCount, payerId, checkIn: start, checkOut: end, status: "checkin", totalValue: input.totalValue, originalValue: input.totalValue, nightlyPrices: prices, priceExceptionReason: input.priceExceptionReason } })
  const stay = await ensureStay(tx, reservation.id, false, { captureRoomConsumption: !completed })
  await tx.stay.update({ where: { id: stay.id }, data: { checkIn: start, checkOut: end, arrivalReason: input.reason, ...(existing && (start.getTime() !== existing.checkIn.getTime() || end.getTime() !== existing.checkOut.getTime()) ? { nightlyPrices: agreedArrivalPrices(input.checkIn, departure, input.totalValue, input.guestCount) as unknown as Prisma.InputJsonValue } : {}) } })
  await tx.stayAllocation.updateMany({ where: { stayId: stay.id }, data: { start, end } })
  if (!completed) {
    const settings = await tx.systemSettings.findFirst()
    await tx.room.update({ where: { id: room.id }, data: { status: "ocupado", guest: guest.name, guestCpf: guest.cpf, checkIn: start, checkOut: end, checkOutTime: settings?.checkOutTime ?? "12:00", recordVersion: { increment: 1 } } })
  }
  await tx.guestProfile.update({ where: { cpf: guest.cpf }, data: { totalStays: { increment: 1 } } })
  await receiveBookingDeposit(tx, actor, [reservation.id], input.initialPayment)
  if (completed) await finishStay(tx, actor, await tx.stay.findUniqueOrThrow({ where: { id: stay.id }, include: stayInclude }), input.dueDate, input.companyCreditConfirmed, { historicalEnd: departure })
  await recordAudit(tx, actor, completed ? "Hospedagem encerrada registrada" : "Check-in realizado", reservation.id, { entityType: "reservations", entityId: reservation.id, operation: "update", metadata: { actualArrival: input.checkIn, expectedArrival: existing?.checkIn.toISOString().slice(0, 10), actualDeparture: completed ? departure : undefined, expectedDeparture: existing?.checkOut.toISOString().slice(0, 10), reason: input.reason, recordedAt: new Date().toISOString(), completed } })
  return (await import("./db/relational-data-service")).collectionMapper("reservations").toApp(await tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } }))
}
