/**
 * Reservation Repository
 * 
 * Manages reservation data with specific business logic.
 */

import { BaseRepository } from "./base-repository"
import type { Reservation } from "../../store"
import type { IStorageAdapter } from "../types"
import { validateReservation } from "../../utils/validators"
import { generateReservationId } from "../../utils/id-generators"

export class ReservationRepository extends BaseRepository<Reservation> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "reservations", { cacheEnabled: true, userId })
  }

  protected generateId(items: Reservation[]): string {
    return generateReservationId(items.length + 1)
  }

  protected validate(reservation: Partial<Reservation>): { valid: boolean; error?: string } {
    return validateReservation(reservation)
  }

  /**
   * Find reservations by guest CPF
   */
  async findByCPF(cpf: string): Promise<Reservation[]> {
    const reservations = await this.getAll()
    return reservations.filter(r => r.cpf === cpf)
  }

  /**
   * Find reservations by room ID
   */
  async findByRoomId(roomId: number): Promise<Reservation[]> {
    const reservations = await this.getAll()
    return reservations.filter(r => r.roomId === roomId)
  }

  /**
   * Find reservations by status
   */
  async findByStatus(status: Reservation["status"]): Promise<Reservation[]> {
    return this.query({ status } as Partial<Reservation>)
  }

  /**
   * Find active reservations (confirmed or checked-in)
   */
  async findActive(): Promise<Reservation[]> {
    const reservations = await this.getAll()
    return reservations.filter(r => 
      r.status === "confirmada" || r.status === "checkin"
    )
  }

  /**
   * Find reservations by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<Reservation[]> {
    const reservations = await this.getAll()
    return reservations.filter(r => {
      const checkIn = new Date(r.checkIn)
      const checkOut = new Date(r.checkOut)
      const start = new Date(startDate)
      const end = new Date(endDate)
      
      return (checkIn >= start && checkIn <= end) ||
             (checkOut >= start && checkOut <= end) ||
             (checkIn <= start && checkOut >= end)
    })
  }
}
