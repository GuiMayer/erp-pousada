import { describe, expect, it } from "vitest"
import { buildLodgingReport } from "@/lib/reports/lodging"
import { createDemoData } from "@/lib/demo-data"
const now = new Date("2026-10-22T15:00:00Z")
describe("Critério único para indicadores de hospedagem", () => {
  it("reconhece noites prestadas sem somar sinais ou recebimentos", () => {
    const report = buildLodgingReport({ section: "hospedagem", start: "2026-10-19", end: "2026-10-22" }, now, [{ id: "stay", reservationId: "booking", guestName: "Ana", roomId: 1, checkIn: "2026-10-19", checkOut: "2026-10-21", status: "closed", endedAt: "2026-10-21T15:00:00Z", lodgingValue: 200, allocations: [{ id: "alloc", roomId: 1, start: "2026-10-19", end: "2026-10-21" }] }], 2, [])
    const metrics = Object.fromEntries(report.metrics.map(m => [m.key, m.value]))
    expect(metrics).toMatchObject({ lodgingAgreed: 200, lodgingProvided: 200, roomNights: 2, capacityNights: 6, occupancy: 33.33, adr: 100 })
    expect(report.rows).toHaveLength(2)
  })
  it("não reconhece a noite de hoje como prestada nem inclui reserva ainda sem hospedagem", () => {
    const data = createDemoData(now)
    const report = buildLodgingReport({ section: "hospedagem", start: "2026-10-22", end: "2026-10-25" }, now, data.stays, data.rooms.length, data.reservations)
    expect(report.metrics.find(m => m.key === "lodgingProvided")?.value).toBe(0)
    expect(report.metrics.find(m => m.key === "occupancy")?.value).toBe(0)
    expect(report.rows.some(row => row.source.id === "demo-stay-DEMO-R009")).toBe(false)
  })
})
