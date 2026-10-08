import { describe, expect, it } from "vitest"
import { businessDay, netItemValues, normalizePayment } from "@/lib/utils/business-values"
import { calculateCartSubtotal, calculateCartTotal } from "@/lib/utils/price-calculations"
import { unitFactor } from "@/lib/utils/units"

describe("Regressões de datas, valores e unidades", () => {
  it("mantém datas de hospedagem e usa São Paulo para timestamps após meia-noite UTC", () => {
    expect(businessDay("2026-10-08")).toBe("2026-10-08")
    expect(businessDay("2026-10-08T01:30:00Z")).toBe("2026-10-07")
    expect(businessDay("2026-10-08T03:30:00Z")).toBe("2026-10-08")
  })
  it("reconcilia relatório de produtos com total líquido e distribui centavos", () => {
    const items = [10, 20, 30].map(price => ({ product: { price }, quantity: 1, discount: 10 }))
    const values = netItemValues({ total: 48.59, items })
    expect(values.reduce((sum, value) => sum + Math.round(value * 100), 0)).toBe(4859)
    expect(values).toEqual([8.1, 16.2, 24.29])
    expect(netItemValues({ total: 0, items })).toEqual([0, 0, 0])
  })
  it("arredonda cada linha antes de somar e depois o desconto global", () => {
    const subtotal = calculateCartSubtotal([1, 2].map(() => ({ product: { price: 0.05 }, quantity: 1, discount: 10 })))
    expect(subtotal).toBe(0.10)
    expect(calculateCartTotal(subtotal, subtotal * 10 / 100)).toBe(0.09)
  })
  it("agrupa aliases da mesma forma de pagamento", () => {
    expect(["credito", "Cartão Crédito", "Cartao Credito"].map(normalizePayment)).toEqual(Array(3).fill("Cartao Credito"))
    expect(normalizePayment("pix")).toBe("PIX")
  })
  it("converte massa e volume, recusando mistura entre dimensões", () => {
    expect(10 * unitFactor("g", "kg")).toBe(0.01)
    expect(500 * unitFactor("ml", "l")).toBe(0.5)
    expect(500 * unitFactor("ml", "lt")).toBe(0.5)
    expect(unitFactor("unidade", "un")).toBe(1)
    expect(() => unitFactor("g", "ml")).toThrow()
    expect(() => unitFactor("kg", "un")).toThrow()
  })
})
