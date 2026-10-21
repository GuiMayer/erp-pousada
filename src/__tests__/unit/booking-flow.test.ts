import { describe, expect, it } from "vitest"
import { cancellationAmounts, cancellationReason, checkinDateError, noShowEligible } from "@/lib/booking-flow"

describe("Datas de atendimento e cancelamento", () => {
  it("recusa entrada futura e distingue hospedagem ativa de encerrada", () => {
    expect(checkinDateError("2026-10-22", "2026-10-23", false, "2026-10-21")).toMatch(/futuro/)
    expect(checkinDateError("2026-10-20", "2026-10-23", false, "2026-10-21")).toBeUndefined()
    expect(checkinDateError("2026-10-19", "2026-10-20", true, "2026-10-21")).toBeUndefined()
    expect(checkinDateError("2026-10-19", "2026-10-20", false, "2026-10-21")).toMatch(/encerrada/)
  })
  it("usa o horário configurado no dia operacional", () => {
    const now = new Date("2026-10-21T18:30:00Z")
    expect(noShowEligible("2026-10-21", "16:00", now)).toBe(false)
    expect(noShowEligible("2026-10-21", "15:00", now)).toBe(true)
    expect(noShowEligible("2026-10-22", "14:00", now)).toBe(false)
  })
  it("motivo opcional aceita vazio, normaliza e limita tamanho", () => {
    expect(cancellationReason.parse("   ")).toBeUndefined()
    expect(cancellationReason.parse("  Mudança de planos  ")).toBe("Mudança de planos")
    expect(cancellationReason.safeParse("x".repeat(501)).success).toBe(false)
  })
  it("devolve ou retém apenas o recebido e conserva os centavos", () => {
    expect(cancellationAmounts(100, "refund")).toEqual({ refund: 100, retained: 0, credit: 0 })
    expect(cancellationAmounts(100, "retain")).toEqual({ refund: 0, retained: 100, credit: 0 })
    expect(cancellationAmounts(100, "refund", 60)).toEqual({ refund: 60, retained: 40, credit: 0 })
    expect(cancellationAmounts(0, "refund").refund).toBe(0)
    expect(() => cancellationAmounts(100, "refund", 101)).toThrow()
  })
})
