import type { AccountReceivable } from "./store"

export function receivableAmounts(titles: Pick<AccountReceivable, "value" | "paidValue" | "status">[]) {
  let total = 0, received = 0, balance = 0
  for (const title of titles) {
    const value = Math.round(title.value * 100), paid = Math.round((title.paidValue ?? (title.status === "pago" ? title.value : 0)) * 100)
    total += value; received += paid
    if (title.status !== "cancelado") balance += Math.max(0, value - paid)
  }
  return { total: total / 100, received: received / 100, balance: balance / 100 }
}
