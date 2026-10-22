import type { NightlyPrice } from "./lodging-pricing"

export function groupLodgingNights(nights: NightlyPrice[]) {
  const groups: { start: string; end: string; count: number; night: NightlyPrice }[] = []
  for (const night of [...nights].sort((a, b) => a.date.localeCompare(b.date))) {
    const previous = groups.at(-1)
    const same = previous && Date.parse(night.date) - Date.parse(previous.end) === 86400000 &&
      previous.night.guests === night.guests && previous.night.tariffName === night.tariffName &&
      previous.night.tariffId === night.tariffId && previous.night.tariffVersion === night.tariffVersion &&
      Math.round(previous.night.total * 100) === Math.round(night.total * 100) &&
      Math.round(previous.night.pricePerPerson * 100) === Math.round(night.pricePerPerson * 100)
    if (same) { previous.end = night.date; previous.count++ }
    else groups.push({ start: night.date, end: night.date, count: 1, night })
  }
  return groups
}

export type DiscountType = "percent" | "fixed"
export type DiscountScope = "total" | "night"

/** A nightly fixed discount applies to every contracted night; percentages use the current balance of the agreed price. */
export function lodgingDiscount(total: number, checkIn: string, checkOut: string, type: DiscountType, value: number, scope: DiscountScope) {
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000
  if (scope === "night" && (!Number.isInteger(nights) || nights < 1 || nights > 366)) throw new Error("Período de diárias inválido")
  if (!Number.isFinite(value) || value <= 0 || Math.abs(value * 100 - Math.round(value * 100)) > .00001 || type === "percent" && value > 100) throw new Error("Informe um desconto positivo, com até duas casas decimais e percentual até 100%.")
  const cents = Math.round(total * 100)
  const amount = type === "percent" ? Math.round(cents * Math.round(value * 100) / 10000) : Math.round(value * 100) * (scope === "night" ? nights : 1)
  if (!Number.isSafeInteger(amount) || amount > cents) throw new Error("Desconto excede o valor contratado.")
  return { nights, amount: amount / 100, remaining: (cents - amount) / 100 }
}
