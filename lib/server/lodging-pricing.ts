import type { Prisma } from "@prisma/client"
import type { Actor } from "./auth"
import { demand } from "./permissions"
import { HttpError } from "./http"
import { quoteLodging, quoteInputSchema, tariffSchema, tariffsOverlap, type NightlyPrice } from "@/lib/lodging-pricing"

export async function validateTariff(tx: Prisma.TransactionClient, data: Record<string, unknown>, current?: Record<string, unknown> | null) {
  const date = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
  const tariff = tariffSchema.parse({ ...current, ...data, pricePerPerson: Number(data.pricePerPerson ?? current?.pricePerPerson), validFrom: date(data.validFrom ?? current?.validFrom), validTo: data.validTo === null ? null : data.validTo || current?.validTo ? date(data.validTo ?? current?.validTo) : null })
  if (tariff.roomId && !await tx.room.findUnique({ where: { id: tariff.roomId } })) throw new HttpError(400, "Quarto não encontrado")
  if (!tariff.roomId && !await tx.room.findFirst({ where: { type: tariff.roomType } })) throw new HttpError(400, "Categoria de quarto não encontrada")
  const others = await tx.lodgingTariff.findMany({ where: { id: { not: tariff.id }, active: true } })
  if (others.some(t => tariffsOverlap(tariff, { ...t, pricePerPerson: Number(t.pricePerPerson), validFrom: t.validFrom.toISOString().slice(0, 10), validTo: t.validTo?.toISOString().slice(0, 10) }))) throw new HttpError(409, "Tarifa sobrepõe outra da mesma categoria/quarto, ocupação e vigência")
}

export async function serverQuote(tx: Prisma.TransactionClient, input: unknown) {
  const request = quoteInputSchema.parse(input)
  const room = await tx.room.findUniqueOrThrow({ where: { id: request.roomId } })
  const rows = await tx.lodgingTariff.findMany({ where: { active: true, OR: [{ roomId: request.roomId }, { roomId: null, roomType: room.type }] } })
  try { return quoteLodging(room, rows.map(t => ({ ...t, pricePerPerson: Number(t.pricePerPerson), validFrom: t.validFrom.toISOString().slice(0, 10), validTo: t.validTo?.toISOString().slice(0, 10) })), request) }
  catch (error) { throw new HttpError(409, error instanceof Error ? error.message : "Não foi possível calcular a diária") }
}

export async function agreedPrice(tx: Prisma.TransactionClient, actor: Actor, input: { roomId: number; guestCount?: number; checkIn: string; checkOut: string; totalValue: number; priceExceptionReason?: string }, current?: { guestCount: number | null; nightlyPrices: Prisma.JsonValue | null; totalValue: Prisma.Decimal; roomId: number; checkIn: Date; checkOut: Date } | null) {
  if (input.guestCount === undefined) {
    if (current?.guestCount) throw new HttpError(400, "Informe a ocupação da reserva")
    if (!current) demand(actor, "lodgingTariffs.override")
    return undefined // Historical records keep their original manually agreed price.
  }
  const room = await tx.room.findUniqueOrThrow({ where: { id: input.roomId } })
  if (!room.capacity || input.guestCount > room.capacity) throw new HttpError(409, "Configure a capacidade e respeite a lotação do quarto")
  if (current?.nightlyPrices && current.roomId === input.roomId && current.guestCount === input.guestCount && current.checkIn.toISOString().slice(0, 10) === input.checkIn && current.checkOut.toISOString().slice(0, 10) === input.checkOut && current.totalValue.equals(input.totalValue)) return current.nightlyPrices
  let nights: NightlyPrice[]
  if (input.priceExceptionReason?.trim()) {
    demand(actor, "lodgingTariffs.override")
    const days = (Date.parse(input.checkOut) - Date.parse(input.checkIn)) / 86400000
    if (!Number.isInteger(days) || days < 1 || days > 366) throw new HttpError(400, "Período inválido")
    const cents = Math.round(input.totalValue * 100), perNight = Math.floor(cents / days)
    nights = Array.from({ length: days }, (_, i) => {
      const total = (perNight + (i < cents % days ? 1 : 0)) / 100
      return { date: new Date(Date.parse(input.checkIn) + i * 86400000).toISOString().slice(0, 10), guests: input.guestCount!, pricePerPerson: total / input.guestCount!, total, tariffName: "Preço autorizado" }
    })
  } else {
    const quote = await serverQuote(tx, { roomId: input.roomId, guestCount: input.guestCount, checkIn: input.checkIn, checkOut: input.checkOut })
    if (Math.round(quote.total * 100) !== Math.round(input.totalValue * 100)) throw new HttpError(409, "Tarifa alterada. Recalcule o preço antes de confirmar")
    nights = quote.nights
  }
  return nights as unknown as Prisma.InputJsonValue
}
