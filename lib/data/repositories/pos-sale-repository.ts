/**
 * POS Sale Repository
 * 
 * Manages POS sales transactions.
 */

import { BaseRepository } from "./base-repository"
import type { POSSale } from "../../store"
import type { IStorageAdapter } from "../types"

export class POSSaleRepository extends BaseRepository<POSSale> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "posSales", { cacheEnabled: true, userId })
  }

  protected generateId(items: POSSale[]): string {
    return `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find sales by status
   */
  async findByStatus(status: POSSale["status"]): Promise<POSSale[]> {
    return this.query({ status } as Partial<POSSale>)
  }

  /**
   * Find sales by operator
   */
  async findByOperator(operator: string): Promise<POSSale[]> {
    return this.query({ operator } as Partial<POSSale>)
  }

  /**
   * Find sales by payment method
   */
  async findByPaymentMethod(paymentMethod: string): Promise<POSSale[]> {
    return this.query({ paymentMethod } as Partial<POSSale>)
  }

  /**
   * Find sales by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<POSSale[]> {
    const sales = await this.getAll()
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    return sales.filter(s => {
      const date = new Date(s.date)
      return date >= start && date <= end
    })
  }

  /**
   * Get total sales value
   */
  async getTotalSales(): Promise<number> {
    const sales = await this.getAll()
    return sales
      .filter(s => s.status === "finalizada")
      .reduce((sum, s) => sum + s.total, 0)
  }

  /**
   * Get sales by customer
   */
  async findByCustomer(customer: string): Promise<POSSale[]> {
    const sales = await this.getAll()
    return sales.filter(s => s.customer === customer)
  }
}
