import { describe, expect, it } from "vitest"
import { pendingReservationGroups } from "@/lib/reservation-groups"
import type { Reservation } from "@/lib/store"

const reservation = (id: string, roomNumber: string, extra: Partial<Reservation> = {}): Reservation => ({
  id, roomNumber, roomId: Number(roomNumber), cpf: "", guestName: "Pessoa", checkIn: "2026-10-22", checkOut: "2026-10-24", status: "confirmada", totalValue: 100, ...extra,
})
describe("Agrupamento das chegadas por reserva de vários quartos", () => {
  it("usa somente o vínculo explícito, ordena números e soma os quartos pendentes", () => {
    const records = [reservation("b", "10", { groupId: "g", totalValue: 0.2 }), reservation("a", "2", { groupId: "g", totalValue: 0.1 }), reservation("c", "101"), reservation("d", "102")]
    const before = structuredClone(records)
    const result = pendingReservationGroups(records)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ key: "group:g", roomNumbers: "2, 10", totalValue: 0.3, isGroup: true })
    expect(result[0].pending.map(r => r.id)).toEqual(["a", "b"])
    expect(records).toEqual(before)
  })
  it("retira quartos iniciados ou concluídos da linha, preservando o contexto ao abrir", () => {
    const result = pendingReservationGroups([reservation("a", "101", { groupId: "g", status: "checkin" }), reservation("b", "102", { groupId: "g" }), reservation("c", "103", { groupId: "g", status: "cancelada" })])
    expect(result[0]).toMatchObject({ roomNumbers: "102", totalValue: 100, isGroup: true })
    expect(result[0].pending.map(r => r.id)).toEqual(["b"])
    expect(result[0].members).toHaveLength(3)
    expect(pendingReservationGroups(result[0].members.map(r => ({ ...r, status: "checkout" })))).toEqual([])
  })
  it("ordena pela primeira chegada pendente e evita colisões entre IDs de grupo e reserva", () => {
    const result = pendingReservationGroups([reservation("g", "105"), reservation("x", "103", { groupId: "g", checkIn: "2026-10-20" }), reservation("y", "102", { groupId: "g", checkIn: "2026-10-25" })])
    expect(result.map(g => g.key)).toEqual(["group:g", "reservation:g"])
    expect(result[0].pending.map(r => r.checkIn)).toEqual(["2026-10-25", "2026-10-20"])
  })
  it("mantém reserva de um quarto com ações diretas mesmo com identificador de grupo", () => {
    expect(pendingReservationGroups([reservation("a", "101", { groupId: "single" })])[0].isGroup).toBe(false)
  })
})
