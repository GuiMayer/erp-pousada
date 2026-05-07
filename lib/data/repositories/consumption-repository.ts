/**
 * Room Consumption Repository
 * 
 * Manages room consumption items (minibar, room service, etc.).
 */

import { BaseRepository } from "./base-repository"
import type { RoomConsumption } from "../../store"
import type { IStorageAdapter } from "../types"

export class ConsumptionRepository extends BaseRepository<RoomConsumption> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "consumptions", { cacheEnabled: true, userId })
  }

  protected generateId(items: RoomConsumption[]): number {
    // Use roomId as the ID since each room has only one consumption record
    return 0 // This will be overridden by roomId
  }

  /**
   * Get consumption by room ID
   */
  async getByRoomId(roomId: number): Promise<RoomConsumption | null> {
    const consumptions = await this.getAll()
    return consumptions.find(c => c.roomId === roomId) ?? null
  }

  /**
   * Create or update consumption for a room
   */
  async upsertByRoomId(consumption: RoomConsumption): Promise<RoomConsumption> {
    const existing = await this.getByRoomId(consumption.roomId)
    
    if (existing) {
      return this.update(existing.roomId, consumption)
    } else {
      // Override the ID with roomId
      return this.create({ ...consumption, id: consumption.roomId } as any)
    }
  }

  /**
   * Clear consumption for a room
   */
  async clearByRoomId(roomId: number): Promise<void> {
    const existing = await this.getByRoomId(roomId)
    if (existing) {
      await this.delete(roomId)
    }
  }

  /**
   * Get total consumption value for a room
   */
  async getTotalByRoomId(roomId: number): Promise<number> {
    const consumption = await this.getByRoomId(roomId)
    if (!consumption) return 0
    
    return consumption.items.reduce((sum, item) => 
      sum + (item.unitPrice * item.quantity), 0
    )
  }
}
