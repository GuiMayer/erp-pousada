/**
 * Restaurant Table Repository
 * 
 * Manages restaurant table data.
 */

import { BaseRepository } from "./base-repository"
import type { RestaurantTable } from "../../store"
import type { IStorageAdapter } from "../types"

export class RestaurantTableRepository extends BaseRepository<RestaurantTable> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "restaurantTables", { cacheEnabled: true, userId })
  }

  protected generateId(items: RestaurantTable[]): number {
    if (items.length === 0) return 1
    return Math.max(...items.map(t => t.id)) + 1
  }

  /**
   * Find table by number
   */
  async findByNumber(number: string): Promise<RestaurantTable | null> {
    const tables = await this.getAll()
    return tables.find(t => t.number === number) ?? null
  }

  /**
   * Find tables by status
   */
  async findByStatus(status: RestaurantTable["status"]): Promise<RestaurantTable[]> {
    return this.query({ status } as Partial<RestaurantTable>)
  }

  /**
   * Find available tables
   */
  async findAvailable(): Promise<RestaurantTable[]> {
    return this.findByStatus("livre")
  }

  /**
   * Find occupied tables
   */
  async findOccupied(): Promise<RestaurantTable[]> {
    return this.findByStatus("ocupada")
  }
}
