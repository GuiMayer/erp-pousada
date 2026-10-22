import { describe, expect, it } from "vitest"
import { roomPlan } from "@/lib/room-planning"
import type { Room, Reservation } from "@/lib/store"
import type { Stay } from "@/lib/stays"
const room = { id: 1, number: "101", status: "ocupado" } as Room
const booking = { id: "r", roomId: 1, checkIn: "2026-10-25", checkOut: "2026-10-27", status: "confirmada" } as Reservation
const stay = { id: "s", reservationId: "s-r", roomId: 2, status: "active", checkIn: "2026-10-20", checkOut: "2026-10-28", allocations: [{ roomId: 1, start: "2026-10-20", end: "2026-10-24" }, { roomId: 2, start: "2026-10-24", end: "2026-10-28" }] } as Stay
describe("Planejamento futuro do quarto", () => {
  it("usa reservas futuras e libera a data de saída sem copiar ocupação ou limpeza atuais", () => {
    expect(roomPlan(room, [booking], [], "2026-10-25").status).toBe("ocupado")
    expect(roomPlan(room, [booking], [], "2026-10-27").status).toBe("disponivel")
    expect(roomPlan({ ...room, status: "limpeza" }, [], [], "2026-10-25").status).toBe("disponivel")
  })
  it("respeita transferências e não duplica a reserva de uma hospedagem", () => {
    const reservation = { ...booking, id: "s-r", status: "checkin", checkIn: stay.checkIn, checkOut: stay.checkOut } as Reservation
    expect(roomPlan(room, [reservation], [stay], "2026-10-23").stays).toHaveLength(1)
    expect(roomPlan(room, [reservation], [stay], "2026-10-23").ambiguous).toBe(false)
    expect(roomPlan(room, [reservation], [stay], "2026-10-24").status).toBe("disponivel")
  })
  it("mantém bloqueio sem previsão e encerra bloqueio com data após o último dia", () => {
    expect(roomPlan({ ...room, status: "bloqueado" }, [], [], "2099-01-01").blocked).toBe(true)
    expect(roomPlan({ ...room, status: "bloqueado", blockEndDate: "2026-10-25" }, [], [], "2026-10-25").blocked).toBe(true)
    expect(roomPlan({ ...room, status: "bloqueado", blockEndDate: "2026-10-25" }, [], [], "2026-10-26").blocked).toBe(false)
  })
  it("ignora canceladas, encerradas e ausências e detecta planejamento conflitante", () => {
    for (const status of ["cancelada", "checkout", "noshow"] as const) expect(roomPlan(room, [{ ...booking, status }], [], "2026-10-25").status).toBe("disponivel")
    expect(roomPlan(room, [booking, { ...booking, id: "other" }], [], "2026-10-25").ambiguous).toBe(true)
  })
})
