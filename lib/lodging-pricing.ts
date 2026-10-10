import { z } from "zod"

export const tariffSchema = z.object({
  id: z.string().min(1).max(100), recordVersion: z.number().int().nonnegative().optional(),
  name: z.string().trim().min(1).max(100),
  roomType: z.string().trim().min(1).max(100), roomId: z.number().int().positive().nullable().optional(),
  minGuests: z.number().int().min(1).max(100), maxGuests: z.number().int().min(1).max(100),
  pricePerPerson: z.number().positive().max(999999).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < .00001, "Use duas casas decimais"),
  validFrom: z.string().date(), validTo: z.string().date().nullable().optional(), active: z.boolean(),
}).strict().refine(t => t.maxGuests >= t.minGuests, "Faixa de ocupação inválida")
  .refine(t => !t.validTo || t.validTo >= t.validFrom, "Vigência inválida")
export type LodgingTariff = z.infer<typeof tariffSchema>
export type NightlyPrice = { date: string; guests: number; pricePerPerson: number; total: number; tariffId?: string; tariffVersion?: number; tariffName: string }
export type LodgingQuote = { nights: NightlyPrice[]; total: number }
export const quoteInputSchema = z.object({ roomId: z.number().int().positive(), guestCount: z.number().int().min(1).max(100), checkIn: z.string().date(), checkOut: z.string().date() }).strict()

export function tariffsOverlap(a: LodgingTariff, b: LodgingTariff) {
  const sameScope = a.roomId ? a.roomId === b.roomId : !b.roomId && a.roomType === b.roomType
  return a.active && b.active && sameScope && a.minGuests <= b.maxGuests && b.minGuests <= a.maxGuests &&
    a.validFrom <= (b.validTo || "9999-12-31") && b.validFrom <= (a.validTo || "9999-12-31")
}

export function quoteLodging(room: { id: number; type: string; capacity?: number | null }, tariffs: LodgingTariff[], input: z.infer<typeof quoteInputSchema>): LodgingQuote {
  quoteInputSchema.parse(input)
  if (!room.capacity) throw new Error("Configure a capacidade do quarto antes de calcular a diária")
  if (input.guestCount > room.capacity) throw new Error(`Quarto comporta até ${room.capacity} pessoa(s)`)
  const start = Date.parse(input.checkIn), end = Date.parse(input.checkOut)
  const days = (end - start) / 86400000
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error("A estadia deve ter entre 1 e 366 noites")
  const nights: NightlyPrice[] = []
  let cents = 0
  for (let i = 0; i < days; i++) {
    const date = new Date(start + i * 86400000).toISOString().slice(0, 10)
    const candidates = tariffs.filter(t => t.active && input.guestCount >= t.minGuests && input.guestCount <= t.maxGuests && date >= t.validFrom && (!t.validTo || date <= t.validTo) && (t.roomId ? t.roomId === room.id : t.roomType === room.type))
    const specific = candidates.filter(t => t.roomId === room.id)
    const eligible = specific.length ? specific : candidates
    if (!eligible.length) throw new Error(`Nenhuma tarifa para ${input.guestCount} pessoa(s) na noite ${date}`)
    if (eligible.length !== 1) throw new Error(`Tarifas conflitantes na noite ${date}; revise o cadastro`)
    const tariff = eligible[0], nightCents = Math.round(tariff.pricePerPerson * 100) * input.guestCount
    cents += nightCents
    nights.push({ date, guests: input.guestCount, pricePerPerson: tariff.pricePerPerson, total: nightCents / 100, tariffId: tariff.id, tariffVersion: tariff.recordVersion ?? 0, tariffName: tariff.name })
  }
  return { nights, total: cents / 100 }
}
