/**
 * Stock Movement Repository
 * 
 * Manages stock movement records (entrada, saida, ajuste, perda).
 */

import { BaseRepository } from "./base-repository"
import type { StockMovement } from "../../store"
import type { IStorageAdapter } from "../types"

export class StockMovementRepository extends BaseRepository<StockMovement> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "stockMovements", { cacheEnabled: true, userId })
  }

  protected generateId(items: StockMovement[]): string {
    return `mov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find movements by stock item ID
   */
  async findByStockItemId(stockItemId: string): Promise<StockMovement[]> {
    return this.query({ productId: stockItemId } as Partial<StockMovement>)
  }

  /**
   * Find movements by type
   */
  async findByType(type: StockMovement["type"]): Promise<StockMovement[]> {
    return this.query({ type } as Partial<StockMovement>)
  }

  /**
   * Find movements by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<StockMovement[]> {
    const movements = await this.getAll()
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    return movements.filter(m => {
      const date = new Date(m.timestamp)
      return date >= start && date <= end
    })
  }
}
