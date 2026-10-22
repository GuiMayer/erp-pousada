import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { groupLodgingNights, lodgingDiscount } from "@/lib/lodging-summary"
import { LodgingNightsSummary } from "@/components/lodging-nights-summary"
import type { NightlyPrice } from "@/lib/lodging-pricing"

const night = (date: string, overrides: Partial<NightlyPrice> = {}): NightlyPrice => ({ date, guests: 2, tariffName: "Luxo · duas pessoas", total: 200, pricePerPerson: 100, tariffId: "luxo", tariffVersion: 0, ...overrides })
describe("Resumo das diárias", () => {
  it("agrupa somente noites consecutivas e iguais, sem alterar os registros", () => {
    const input = [night("2026-10-23"), night("2026-10-21"), night("2026-10-22"), night("2026-10-25"), night("2026-10-26", { total: 220 }), night("2026-10-27", { total: 220, tariffName: "Outra tarifa" })]
    expect(groupLodgingNights(input).map(g => [g.start, g.end, g.count])).toEqual([
      ["2026-10-21", "2026-10-23", 3], ["2026-10-25", "2026-10-25", 1], ["2026-10-26", "2026-10-26", 1], ["2026-10-27", "2026-10-27", 1],
    ])
    expect(input[0].date).toBe("2026-10-23")
    expect(groupLodgingNights([night("2026-10-21"), night("2026-10-22", { guests: 1 })])).toHaveLength(2)
  })
  it("apresenta intervalo em português, quantidade e preço unitário", () => {
    render(<LodgingNightsSummary nights={[night("2026-10-21"), night("2026-10-22")]} />)
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    expect(screen.getByText("21-10-2026 - 22-10-2026")).toBeInTheDocument()
    expect(screen.getByText(/2 diárias • R\$/)).toHaveTextContent(/200,00/)
    expect(screen.getByTitle(/Total:.*400,00/)).toBeInTheDocument()
  })
})
describe("Desconto por total ou diária", () => {
  const calculate = (type: "fixed" | "percent", value: number, scope: "total" | "night") => lodgingDiscount(600, "2026-10-21", "2026-10-24", type, value, scope)
  it("calcula fixo uma vez no total ou por todas as noites, excluindo a saída", () => {
    expect(calculate("fixed", 20, "total")).toMatchObject({ amount: 20, remaining: 580 })
    expect(calculate("fixed", 20, "night")).toEqual({ nights: 3, amount: 60, remaining: 540 })
    expect(calculate("percent", 10, "night")).toEqual(calculate("percent", 10, "total"))
    expect(lodgingDiscount(99.99, "2026-10-21", "2026-10-24", "percent", 3.33, "night").amount).toBe(3.33)
  })
  it("rejeita negativos, valores excedentes, percentual inválido e períodos sem diárias", () => {
    for (const value of [-1, 0, NaN, Infinity, 0.001]) expect(() => calculate("fixed", value, "total")).toThrow()
    expect(() => calculate("percent", 101, "total")).toThrow()
    expect(() => calculate("fixed", 201, "night")).toThrow()
    expect(() => lodgingDiscount(600, "2026-10-21", "2026-10-21", "fixed", 10, "night")).toThrow()
  })
})
