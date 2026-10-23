import { normalizePayment } from "./utils/business-values"
import { cashIncoming } from "./payments"

export type CashSummary = {
  methods: { method: string; received: number; refunded: number; net: number }[]
  deferred: { value: number; count: number }
  incomingValue: number
  outgoingValue: number
  expectedValue: number
}
type Entry = { operationalSessionId?: string | null; cashSessionId?: string | null; paymentMethod?: string | null; value: number; type: string }
type Charge = { operationalSessionId?: string | null; sourceSaleId?: string | null; id: string; status: string; lineTotal?: number | null; quantity: number; unitPrice: number }
const cents = (value: number) => Math.round(value * 100)

/** Applied ledger values, never sale totals or cash offered by the customer. */
export function summarizeCash(session: { id: string; openingValue?: number }, entries: Entry[], charges: Charge[]): CashSummary {
  const methods = ["Dinheiro", "PIX", "Cartão Débito", "Cartão Crédito"].map(method => {
    const rows = entries.filter(e => e.operationalSessionId === session.id && normalizePayment(e.paymentMethod ?? "") === normalizePayment(method))
    const received = rows.filter(e => e.type === "receita").reduce((n, e) => n + cents(e.value), 0)
    const refunded = rows.filter(e => e.type === "estorno").reduce((n, e) => n + cents(e.value), 0)
    return { method, received: received / 100, refunded: refunded / 100, net: (received - refunded) / 100 }
  })
  const physical = entries.filter(e => e.cashSessionId === session.id)
  const incoming = physical.filter(e => cashIncoming(e.type)).reduce((n, e) => n + cents(e.value), 0)
  const outgoing = physical.filter(e => !cashIncoming(e.type)).reduce((n, e) => n + cents(e.value), 0)
  const deferred = charges.filter(c => c.operationalSessionId === session.id && c.status === "active")
  return { methods, deferred: { value: deferred.reduce((n, c) => n + cents(c.lineTotal ?? c.unitPrice * c.quantity), 0) / 100, count: new Set(deferred.map(c => c.sourceSaleId ?? c.id)).size }, incomingValue: incoming / 100, outgoingValue: outgoing / 100, expectedValue: (cents(session.openingValue ?? 0) + incoming - outgoing) / 100 }
}

