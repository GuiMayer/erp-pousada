/**
 * Production Repository
 * 
 * Manages production records.
 */

import { BaseRepository } from "./base-repository"
import type { Production } from "../../store"
import type { IStorageAdapter } from "../types"

export class ProductionRepository extends BaseRepository<Production> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "productions", { cacheEnabled: true, userId })
  }

  protected generateId(items: Production[]): string {
    return `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find productions by recipe ID
   */
  async findByRecipeId(recipeId: string): Promise<Production[]> {
    return this.query({ recipeId } as Partial<Production>)
  }

  /**
   * Find productions by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<Production[]> {
    const productions = await this.getAll()
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    return productions.filter(p => {
      const date = new Date(p.timestamp)
      return date >= start && date <= end
    })
  }
}
