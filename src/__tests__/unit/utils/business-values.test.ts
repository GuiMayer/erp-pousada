import { describe, expect, it } from "vitest"
import { businessDay, businessHour, businessMonthBounds, netItemValues, normalizePayment } from "@/lib/utils/business-values"
import { calculateCartSubtotal, calculateCartTotal } from "@/lib/utils/price-calculations"
import { unitFactor } from "@/lib/utils/units"

describe("Regressões de datas, valores e unidades", () => {
  it("delimita mês em São Paulo mesmo após a virada UTC", () => {
    const october = businessMonthBounds("2026-11-01T01:00:00Z")
    expect(october.start.toISOString()).toBe("2026-10-01T03:00:00.000Z")
    expect(october.end.toISOString()).toBe("2026-11-01T03:00:00.000Z")
    expect(businessMonthBounds("2026-11-01T03:00:00Z").start).toEqual(october.end)
    expect(businessMonthBounds("2027-01-01T01:00:00Z").end.toISOString()).toBe("2027-01-01T03:00:00.000Z")
    expect(businessMonthBounds("2018-12-15T12:00:00Z").start.toISOString()).toBe("2018-12-01T02:00:00.000Z")
    expect(businessHour("2026-10-09T01:00:00Z")).toBe(22)
    expect(businessHour("2026-10-09T03:00:00Z")).toBe(0)
  })
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
