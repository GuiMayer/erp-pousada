export const BUSINESS_TIME_ZONE = "America/Sao_Paulo"

export function businessDay(value: string | Date = new Date()): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Intl.DateTimeFormat("sv-SE", { timeZone: BUSINESS_TIME_ZONE }).format(new Date(value))
}

export function normalizePayment(value: string): string {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  return ({ dinheiro: "Dinheiro", pix: "PIX", debito: "Cartao Debito", credito: "Cartao Credito", "cartao debito": "Cartao Debito", "cartao credito": "Cartao Credito" } as Record<string, string>)[normalized] ?? value
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Allocate the recorded net total in cents; category/product totals reconcile to sales. */
export function netItemValues(sale: { total: number; items: { product: { price: number }; quantity: number; discount: number }[] }): number[] {
  const bases = sale.items.map(item => Math.round(roundMoney(item.product.price * item.quantity * (1 - item.discount / 100)) * 100))
  const sum = bases.reduce((a, b) => a + b, 0)
  if (!sum) return bases.map(() => 0)
  const cents = Math.round(sale.total * 100)
  const raw = bases.map(value => value / sum * cents)
  const result = raw.map(Math.floor)
  const remainder = cents - result.reduce((a, b) => a + b, 0)
  const order = raw.map((value, index) => ({ index, fraction: value - result[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (let i = 0; i < remainder; i++) result[order[i % order.length].index]++
  return result.map(value => value / 100)
}
