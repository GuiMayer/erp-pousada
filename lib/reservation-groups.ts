import type { Reservation } from "./store"

export type PendingReservationGroup = {
  key: string
  members: Reservation[]
  pending: Reservation[]
  isGroup: boolean
  roomNumbers: string
  totalValue: number
}

const roomOrder = (a: Reservation, b: Reservation) =>
  a.roomNumber.localeCompare(b.roomNumber, "pt-BR", { numeric: true }) || a.checkIn.localeCompare(b.checkIn) || a.id.localeCompare(b.id)

/** Group only explicitly linked reservations; each room keeps its own lifecycle. */
export function pendingReservationGroups(reservations: Reservation[]): PendingReservationGroup[] {
  const groups = new Map<string, Reservation[]>()
  for (const reservation of reservations) {
    const key = reservation.groupId ? `group:${reservation.groupId}` : `reservation:${reservation.id}`
    const members = groups.get(key) ?? []
    members.push(reservation)
    groups.set(key, members)
  }
  return [...groups.entries()].flatMap(([key, records]) => {
    const members = [...records].sort(roomOrder)
    const pending = members.filter(r => r.status === "confirmada")
    if (!pending.length) return []
    return [{ key, members, pending, isGroup: members.length > 1,
      roomNumbers: [...new Set(pending.map(r => r.roomNumber))].join(", "),
      totalValue: pending.reduce((sum, r) => sum + Math.round(r.totalValue * 100), 0) / 100 }]
  }).sort((a, b) => {
    const firstArrival = (group: PendingReservationGroup) => group.pending.reduce((first, r) => r.checkIn < first ? r.checkIn : first, group.pending[0].checkIn)
    return firstArrival(a).localeCompare(firstArrival(b)) || roomOrder(a.pending[0], b.pending[0])
  })
}
