import type { POSSale } from "@/lib/store"
import { distributePayment } from "@/lib/payments"
import { normalizePayment } from "@/lib/utils/business-values"

/** Billing composition; charging a stay is not a cash receipt. Cash change is excluded. */
export function salePaymentBreakdown(sale: POSSale) {
  if (sale.stayId) return [{ method: "Na hospedagem", value: sale.total }]
  const lines = sale.payments?.length ? distributePayment(sale.total, sale.payments).lines.map(p => ({ method: p.method, value: p.applied })) : [{ method: normalizePayment(sale.paymentMethod), value: sale.total }]
  const totals = new Map<string, number>()
  for (const line of lines) totals.set(line.method, (totals.get(line.method) ?? 0) + Math.round(line.value * 100))
  return [...totals].map(([method, value]) => ({ method, value: value / 100 }))
}
export function totalSalesByMethod(sales: POSSale[], method: string) {
  return sales.reduce((sum, s) => sum + salePaymentBreakdown(s).filter(p => p.method === method).reduce((v, p) => v + Math.round(p.value * 100), 0), 0) / 100
}
