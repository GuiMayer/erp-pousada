/**
 * Room Repository
 * 
 * Manages room data with specific business logic for room operations.
 */

import { BaseRepository } from "./base-repository"
import type { Room } from "../../store"
import type { IStorageAdapter } from "../types"
import { validateRoom } from "../../utils/validators"

export class RoomRepository extends BaseRepository<Room> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "rooms", { cacheEnabled: true, userId })
  }

  protected generateId(items: Room[]): number {
    if (items.length === 0) return 1
    return Math.max(...items.map(r => r.id)) + 1
  }

  protected validate(room: Partial<Room>): { valid: boolean; error?: string } {
    return validateRoom(room)
  }

  /**
   * Find room by number
   */
  async findByNumber(number: string): Promise<Room | null> {
    const rooms = await this.getAll()
    return rooms.find(r => r.number === number) ?? null
  }

  /**
   * Find rooms by status
   */
  async findByStatus(status: Room["status"]): Promise<Room[]> {
    return this.query({ status } as Partial<Room>)
  }

  /**
   * Find rooms by type
   */
  async findByType(type: string): Promise<Room[]> {
    return this.query({ type } as Partial<Room>)
  }

  /**
   * Find available rooms
   */
  async findAvailable(): Promise<Room[]> {
    return this.findByStatus("disponivel")
  }

  /**
   * Find occupied rooms
   */
  async findOccupied(): Promise<Room[]> {
    return this.findByStatus("ocupado")
  }
}
