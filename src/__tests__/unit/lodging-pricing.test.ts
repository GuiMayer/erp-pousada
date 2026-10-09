import { describe, expect, it } from "vitest"
import { quoteLodging, tariffsOverlap, tariffSchema, type LodgingTariff } from "@/lib/lodging-pricing"
import { validateCNPJ, validateCPF, normalizeDocument, formatCNPJ } from "@/lib/utils/cpf-cnpj-validator"

const room = { id: 1, type: "Standard", capacity: 3 }
const tariff = (overrides: Partial<LodgingTariff> = {}): LodgingTariff => ({ id: "t1", name: "Uma pessoa", roomType: "Standard", minGuests: 1, maxGuests: 1, pricePerPerson: 120, validFrom: "2026-01-01", active: true, ...overrides })
const input = (guests = 1) => ({ roomId: 1, guestCount: guests, checkIn: "2026-10-09", checkOut: "2026-10-10" })
describe("Preço de hospedagem por pessoa / noite", () => {
  it("AP03: uma pessoa paga 120; duas a 100 pagam 200 por noite", () => {
    const tariffs = [tariff(), tariff({ id: "t2", minGuests: 2, maxGuests: 3, pricePerPerson: 100 })]
    expect(quoteLodging(room, tariffs, input()).total).toBe(120)
    expect(quoteLodging(room, tariffs, { ...input(2), checkOut: "2026-10-11" }).total).toBe(400)
  })
  it("respeita a capacidade mesmo que a faixa de tarifa seja maior", () => {
    expect(() => quoteLodging(room, [tariff({ maxGuests: 10 })], input(4))).toThrow("comporta")
    expect(() => quoteLodging({ ...room, capacity: null }, [tariff()], input())).toThrow("Configure")
  })
  it("a tarifa específica do quarto prevalece sobre a categoria", () => {
    expect(quoteLodging(room, [tariff(), tariff({ id: "room", roomId: 1, pricePerPerson: 110 })], input()).total).toBe(110)
  })
  it("vigências incluem a última noite e excluem o dia de saída", () => {
    const tariffs = [tariff({ validTo: "2026-10-09" }), tariff({ id: "new", validFrom: "2026-10-10", pricePerPerson: 130 })]
    const quote = quoteLodging(room, tariffs, { ...input(), checkOut: "2026-10-11" })
    expect(quote.nights.map(n => n.pricePerPerson)).toEqual([120, 130]); expect(quote.total).toBe(250)
  })
  it("rejeita buracos, ambiguidades e períodos inválidos", () => {
    expect(() => quoteLodging(room, [], input())).toThrow("Nenhuma")
    expect(() => quoteLodging(room, [tariff(), tariff({ id: "ambiguous" })], input())).toThrow("conflitantes")
    expect(() => quoteLodging(room, [tariff()], { ...input(), checkOut: "2026-10-09" })).toThrow("noites")
  })
  it("rejeita sobreposição só no mesmo escopo ativo", () => {
    expect(tariffsOverlap(tariff(), tariff())).toBe(true)
    expect(tariffsOverlap(tariff(), tariff({ roomId: 1 }))).toBe(false)
    expect(tariffsOverlap(tariff(), tariff({ validTo: "2025-12-31" }))).toBe(false)
    expect(tariffsOverlap(tariff(), tariff({ active: false }))).toBe(false)
    expect(tariffSchema.safeParse(tariff({ maxGuests: 0 })).success).toBe(false)
  })
  it("preserva o preço aplicado e reconcilia centavos", () => {
    const t = tariff({ maxGuests: 3, pricePerPerson: 99.99, recordVersion: 2 })
    const quote = quoteLodging(room, [t], input(3)); t.pricePerPerson = 110
    expect(quote.total).toBe(299.97); expect(quote.nights[0]).toMatchObject({ pricePerPerson: 99.99, tariffVersion: 2 })
  })
})
describe("CPF e CNPJ numérico/alfanumérico", () => {
  it("aceita o exemplo oficial alfanumérico e conserva suas letras", () => {
    expect(validateCNPJ("12.abc.345/01de-35")).toBe(true)
    expect(normalizeDocument("12.abc.345/01de-35")).toBe("12ABC34501DE35")
    expect(formatCNPJ("12abc34501de35")).toBe("12.ABC.345/01DE-35")
    expect(validateCNPJ("12ABC34501DE36")).toBe(false)
  })
  it("valida os documentos numéricos e rejeita caracteres extras", () => {
    expect(validateCNPJ("11.222.333/0001-81")).toBe(true)
    expect(validateCPF("529.982.247-25")).toBe(true)
    expect(validateCPF("52998224725A")).toBe(false)
    expect(validateCNPJ("00000000000000")).toBe(false)
    expect(validateCNPJ("!11222333000181")).toBe(false)
  })
})
