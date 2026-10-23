import { normalizePayment } from "./utils/business-values"
import { cashIncoming } from "./payments"

export type CashSummary = {
  methods: { method: string; received: number; refunded: number; net: number }[]
  origins?: { label: string; received: number; refunded: number; net: number }[]
  deferred: { value: number; count: number }
  incomingValue: number
  outgoingValue: number
  expectedValue: number
}
type Entry = { operationalSessionId?: string | null; cashSessionId?: string | null; paymentMethod?: string | null; originType?: string | null; value: number; type: string }
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
  const byOrigin = new Map<string, { received: number; refunded: number }>()
  for (const entry of entries.filter(e => e.operationalSessionId === session.id && ["receita", "estorno"].includes(e.type) && e.paymentMethod)) {
    const origin = entry.originType ?? ""
    const label = /^sale(?:-|$)/.test(origin) ? "Vendas de bebidas" : /^receivable/.test(origin) ? "Contas a receber" : /^(reservation|booking)/.test(origin) ? "Sinais e reservas" : /^stay/.test(origin) ? "Hospedagens e consumo da recepção" : "Outros recebimentos"
    const group = byOrigin.get(label) ?? { received: 0, refunded: 0 }
    if (entry.type === "receita") group.received += cents(entry.value)
    else group.refunded += cents(entry.value)
    byOrigin.set(label, group)
  }
  const origins = [...byOrigin].map(([label, values]) => ({ label, received: values.received / 100, refunded: values.refunded / 100, net: (values.received - values.refunded) / 100 }))
  return { methods, origins, deferred: { value: deferred.reduce((n, c) => n + cents(c.lineTotal ?? c.unitPrice * c.quantity), 0) / 100, count: new Set(deferred.map(c => c.sourceSaleId ?? c.id)).size }, incomingValue: incoming / 100, outgoingValue: outgoing / 100, expectedValue: (cents(session.openingValue ?? 0) + incoming - outgoing) / 100 }
}

