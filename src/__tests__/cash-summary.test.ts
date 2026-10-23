import { describe, it, expect } from "vitest"
import { summarizeCash } from "@/lib/cash-summary"

describe("Resumo de turno", () => {
  it("separa recebimentos, gaveta, devoluções e ficha sem contar transferências", () => {
    const entries = [
      { value: 200, type: "receita", paymentMethod: "Dinheiro", cashSessionId: "a", operationalSessionId: "a" },
      { value: 300, type: "receita", paymentMethod: "pix", operationalSessionId: "a" },
      { value: 400, type: "receita", paymentMethod: "credito", operationalSessionId: "a" },
      { value: 20, type: "estorno", paymentMethod: "pix", operationalSessionId: "a" },
      { value: 10, type: "transferencia_saida", paymentMethod: "Dinheiro", cashSessionId: "a", operationalSessionId: "a" },
      { value: 900, type: "receita", paymentMethod: "PIX" },
    ]
    const summary = summarizeCash({ id: "a", openingValue: 100 }, entries, [{ id: "c", operationalSessionId: "a", status: "active", unitPrice: 25, quantity: 2 }])
    expect(summary.expectedValue).toBe(290)
    expect(summary.methods.reduce((n, m) => n + m.net, 0)).toBe(880)
    expect(summary.deferred).toEqual({ value: 50, count: 1 })
    expect(summary.methods[1]).toEqual({ method: "PIX", received: 300, refunded: 20, net: 280 })
  })
})

