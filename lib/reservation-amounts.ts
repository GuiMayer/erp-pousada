import type { Reservation } from "./store"

/** Presentation of the same contracted amount and receipts used by booking operations. */
export function reservationAmounts(reservations: Pick<Reservation, "totalValue" | "paidValue">[]) {
  const total = reservations.reduce((sum, r) => sum + Math.round(r.totalValue * 100), 0)
  const received = reservations.reduce((sum, r) => sum + Math.round((r.paidValue ?? 0) * 100), 0)
  return { total: total / 100, received: received / 100, balance: Math.max(0, total - received) / 100 }
}
