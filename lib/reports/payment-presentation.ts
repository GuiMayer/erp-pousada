import { normalizePayment } from "@/lib/utils/business-values"
export const paymentPresentation = {
  cash: { label: "Dinheiro", color: "var(--chart-1)" },
  debit: { label: "Cartão de débito", color: "var(--chart-2)" },
  credit: { label: "Cartão de crédito", color: "var(--chart-3)" },
  pix: { label: "PIX", color: "var(--chart-4)" },
  stay: { label: "Na hospedagem", color: "var(--chart-5)" },
  other: { label: "Outras formas", color: "var(--muted-foreground)" },
} as const
export function paymentChartData(data: { method: string; revenue: number; count: number }[]) {
  const values = Object.entries(paymentPresentation).map(([id, style]) => ({ id, ...style, revenue: 0, count: 0, percentage: 0 }))
  const ids: Record<string, string> = { Dinheiro: "cash", "Cartao Debito": "debit", "Cartao Credito": "credit", PIX: "pix", "Na hospedagem": "stay" }
  for (const row of data) {
    const method = normalizePayment(row.method.replace(/ de /gi, " "))
    const item = values.find(item => item.id === (ids[method] ?? "other"))!
    item.revenue += Math.round(row.revenue * 100)
    item.count += row.count
  }
  const total = values.reduce((sum, item) => sum + item.revenue, 0)
  return values.map(item => ({ ...item, percentage: total > 0 ? item.revenue / total * 100 : 0, revenue: item.revenue / 100 }))
}
