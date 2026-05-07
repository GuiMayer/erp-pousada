/**
 * Stock Item Repository
 * 
 * Manages stock inventory items.
 */

import { BaseRepository } from "./base-repository"
import type { StockItem } from "../../store"
import type { IStorageAdapter } from "../types"
import { validateStockItem } from "../../utils/validators"

export class StockItemRepository extends BaseRepository<StockItem> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "stockItems", { cacheEnabled: true, userId })
  }

  protected generateId(items: StockItem[]): string {
    return `stock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  protected validate(item: Partial<StockItem>): { valid: boolean; error?: string } {
    return validateStockItem(item)
  }

  /**
   * Find items by category
   */
  async findByCategory(category: string): Promise<StockItem[]> {
    return this.query({ category } as Partial<StockItem>)
  }

  /**
   * Find items with low stock
   */
  async findLowStock(): Promise<StockItem[]> {
    const items = await this.getAll()
    return items.filter(item => item.currentStock <= item.minStock)
  }

  /**
   * Search items by name
   */
  async searchByName(query: string): Promise<StockItem[]> {
    const items = await this.getAll()
    const searchTerm = query.toLowerCase()
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm)
    )
  }
}
