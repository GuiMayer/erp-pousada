import type { Reservation, Room, RoomStatus } from "./store"
import type { Stay } from "./stays"

/** Forecast occupancy by the date/room actually allocated, rather than today's room state. */
export function roomPlan(room: Room, reservations: Reservation[], stays: Stay[], day: string) {
  const plannedStays = stays.filter(stay => stay.status === "active" && (
    stay.allocations.length ? stay.allocations.some(a => a.roomId === room.id && a.start <= day && day < a.end)
      : stay.roomId === room.id && stay.checkIn <= day && day < stay.checkOut
  ))
  const plannedReservations = reservations.filter(r => r.roomId === room.id &&
    (r.status === "confirmada" || r.status === "checkin" && !stays.some(s => s.reservationId === r.id)) && r.checkIn <= day && day < r.checkOut)
  const blocked = room.status === "bloqueado" && (!room.blockEndDate || day <= room.blockEndDate)
  const count = plannedStays.length + plannedReservations.length
  const status: RoomStatus = blocked ? "bloqueado" : count ? "ocupado" : "disponivel"
  return { status, blocked, reservations: plannedReservations, stays: plannedStays, ambiguous: count > 1 || blocked && count > 0 }
}
