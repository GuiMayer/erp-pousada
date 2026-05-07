/**
 * Cash Close Repository
 * 
 * Manages cash register closing records.
 */

import { BaseRepository } from "./base-repository"
import type { CashClose } from "../../store"
import type { IStorageAdapter } from "../types"

export class CashCloseRepository extends BaseRepository<CashClose> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "cashCloses", { cacheEnabled: true, userId })
  }

  protected generateId(items: CashClose[]): string {
    return `cash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find cash closes by operator
   */
  async findByOperator(operator: string): Promise<CashClose[]> {
    return this.query({ operator } as Partial<CashClose>)
  }

  /**
   * Find cash closes by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<CashClose[]> {
    const closes = await this.getAll()
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    return closes.filter(c => {
      const date = new Date(c.date)
      return date >= start && date <= end
    })
  }

  /**
   * Get recent closes
   */
  async getRecent(limit: number = 10): Promise<CashClose[]> {
    const closes = await this.getAll()
    return closes
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)
  }
}
