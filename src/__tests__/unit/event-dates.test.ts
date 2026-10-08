import { describe, it, expect } from "vitest"
import { getCollectionMapper } from "@/lib/server/db/mappers"
import { businessDay, businessHour } from "@/lib/utils/business-values"

describe("Datas de eventos nos contratos da API", () => {
  it("preserva instante noturno em vendas e no retorno de exportação/importação", () => {
    const mapper = getCollectionMapper("posSales")!
    const original = new Date("2026-10-09T01:00:00.123Z")
    const sale = mapper.toApp({ id: "sale", date: original, items: [], total: 10 }) as { date: string }
    expect(sale.date).toBe(original.toISOString())
    expect(businessDay(sale.date)).toBe("2026-10-08")
    expect(businessHour(sale.date)).toBe(22)
    const restored = mapper.toCreate(JSON.parse(JSON.stringify(sale)))
    expect(restored.date).toEqual(original)
  })
  it("preserva transferência, mas mantém reserva e vencimento como calendário", () => {
    const instant = new Date("2026-10-09T01:00:00Z")
    expect((getCollectionMapper("bankTransfers")!.toApp({ date: instant }) as { date: string }).date).toBe(instant.toISOString())
    const reservation = getCollectionMapper("reservations")!.toApp({ checkIn: instant, checkOut: instant }) as { checkIn: string }
    expect(reservation.checkIn).toBe("2026-10-09")
  })
})
