import type { NightlyPrice } from "./lodging-pricing"

export type Stay = {
  id: string; reservationId: string; payerId?: string | null; guestName: string
  guestCount?: number | null; roomId: number; checkIn: string; checkOut: string
  status: string; lodgingValue: number; nightlyPrices?: NightlyPrice[] | null
  recordVersion: number; endedAt?: string | null; groupId?: string | null
  occupants: { id: string; name: string; customerId?: string | null }[]
  allocations: { id: string; roomId: number; start: string; end: string; reason?: string | null }[]
  charges: { id: string; productId?: string | null; label: string; unitPrice: number; quantity: number; status: string; reason?: string | null; createdAt: string }[]
  payments: { id: string; value: number; bucket: string; method: string; createdAt: string; transactionId?: string | null }[]
  adjustments?: { id: string; value: number; reason: string; createdAt: string }[]
}
const cents = (n: number) => Math.round(n * 100)
export function stayBalance(stay: Stay) {
  const consumption = stay.charges.filter(c => c.status === "active").reduce((s,c) => s + cents(c.unitPrice) * c.quantity, 0)
  const paid = stay.payments.reduce((s,p) => s + cents(p.value), 0)
  const lodgingPaid = stay.payments.filter(p => p.bucket === "lodging").reduce((s,p) => s + cents(p.value), 0)
  const consumptionPaid = stay.payments.filter(p => p.bucket === "consumption").reduce((s,p) => s + cents(p.value), 0)
  const total = cents(stay.lodgingValue) + consumption
  return { total: total / 100, consumption: consumption / 100, paid: paid / 100, balance: (total - paid) / 100, lodgingBalance: (cents(stay.lodgingValue) - lodgingPaid) / 100, consumptionBalance: (consumption - consumptionPaid) / 100 }
}
