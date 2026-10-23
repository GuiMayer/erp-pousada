import type { Customer, Reservation } from "./store"
import { pendingReservationGroups } from "./reservation-groups"
import { calendarDayISO, parseCalendarDay } from "./utils/calendar-date"

export type ArrivalFilter = "all" | "today" | "next" | "late"
export type ReservationFilters = { query: string; arrival: ArrivalFilter; from: string; until: string }
export const emptyReservationFilters: ReservationFilters = { query: "", arrival: "all", from: "", until: "" }
const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")

/** Filter individual arrivals first, then retain the complete group as explicit context. */
export function reservationWorklist(reservations: Reservation[], customers: Pick<Customer, "id" | "name">[], filters: ReservationFilters, today: string, requestedPage = 1, pageSize = 25) {
  const invalidPeriod = !!filters.from && !parseCalendarDay(filters.from) || !!filters.until && !parseCalendarDay(filters.until) || !!filters.from && !!filters.until && filters.from > filters.until
  const end = parseCalendarDay(today)!
  end.setDate(end.getDate() + 7)
  const nextWeek = calendarDayISO(end)
  const payers = new Map(customers.map(customer => [customer.id, customer.name]))
  const tokens = searchable(filters.query.trim()).split(/\s+/).filter(Boolean)
  const matchingIds = new Set(reservations.filter(r => {
    if (invalidPeriod || r.status !== "confirmada" || filters.from && r.checkIn < filters.from || filters.until && r.checkIn > filters.until) return false
    if (filters.arrival === "today" && r.checkIn !== today || filters.arrival === "late" && r.checkIn >= today || filters.arrival === "next" && !(r.checkIn > today && r.checkIn <= nextWeek)) return false
    const text = searchable([r.guestName, payers.get(r.payerId ?? ""), r.roomNumber, r.id, r.groupId].filter(Boolean).join(" "))
    return tokens.every(token => text.includes(token))
  }).map(r => r.id))
  const allGroups = pendingReservationGroups(reservations)
  const selected = allGroups.flatMap(group => {
    const matching = group.pending.filter(r => matchingIds.has(r.id))
    return matching.length ? [{ ...group, matchingIds: matching.map(r => r.id), outsideCount: group.pending.length - matching.length }] : []
  })
  const size = Math.max(1, Math.floor(pageSize))
  const pageCount = Math.max(1, Math.ceil(selected.length / size))
  const page = Math.max(1, Math.min(Math.floor(requestedPage) || 1, pageCount))
  return { allGroups, groups: selected.slice((page - 1) * size, page * size), page, pageCount, groupCount: selected.length, matchingCount: matchingIds.size, pendingCount: allGroups.reduce((n, g) => n + g.pending.length, 0), invalidPeriod: !!invalidPeriod }
}
