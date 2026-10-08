export const BUSINESS_TIME_ZONE = "America/Sao_Paulo"

export function businessDay(value: string | Date = new Date()): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Intl.DateTimeFormat("sv-SE", { timeZone: BUSINESS_TIME_ZONE }).format(new Date(value))
}

/** Events retain their instant; reports use the installation's business zone. */
export function businessHour(value: string | Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(new Date(value)))
}

function businessMidnight(year: number, month: number): Date {
  const target = Date.UTC(year, month - 1, 1)
  let instant = target
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
  // Resolve the IANA offset instead of assuming UTC-3 (historical DST differs).
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]))
    const wallTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
    const correction = target - wallTime
    if (!correction) return new Date(instant)
    instant += correction
  }
  throw new Error("Não foi possível delimitar o mês operacional")
}

export function businessMonthBounds(value: string | Date = new Date()): { start: Date; end: Date } {
  const [year, month] = businessDay(value).split("-").map(Number)
  return { start: businessMidnight(year, month), end: businessMidnight(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1) }
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
