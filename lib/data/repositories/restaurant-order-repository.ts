/**
 * Restaurant Order Repository
 * 
 * Manages restaurant order data.
 */

import { BaseRepository } from "./base-repository"
import type { RestaurantOrder } from "../../store"
import type { IStorageAdapter } from "../types"

export class RestaurantOrderRepository extends BaseRepository<RestaurantOrder> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "restaurantOrders", { cacheEnabled: true, userId })
  }

  protected generateId(items: RestaurantOrder[]): string {
    return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find orders by table ID
   */
  async findByTableId(tableId: number): Promise<RestaurantOrder[]> {
    return this.query({ tableId } as Partial<RestaurantOrder>)
  }

  /**
   * Find orders by status
   */
  async findByStatus(status: RestaurantOrder["status"]): Promise<RestaurantOrder[]> {
    return this.query({ status } as Partial<RestaurantOrder>)
  }

  /**
   * Find open orders
   */
  async findOpen(): Promise<RestaurantOrder[]> {
    return this.findByStatus("aberta")
  }

  /**
   * Find active order for a table
   */
  async findActiveByTableId(tableId: number): Promise<RestaurantOrder | null> {
    const orders = await this.findByTableId(tableId)
    return orders.find(o => o.status === "aberta") ?? null
  }

  /**
   * Get total sales
   */
  async getTotalSales(): Promise<number> {
    const orders = await this.getAll()
    return orders
      .filter(o => o.status === "fechada")
      .reduce((sum, o) => sum + o.total, 0)
  }
}
