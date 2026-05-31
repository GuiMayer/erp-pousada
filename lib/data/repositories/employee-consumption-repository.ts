/**
 * Employee Consumption Repository
 * 
 * Manages employee consumption records.
 */

import { BaseRepository } from "./base-repository"
import type { EmployeeConsumption } from "../../store"
import type { IStorageAdapter } from "../types"

export class EmployeeConsumptionRepository extends BaseRepository<EmployeeConsumption> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "employeeConsumptions", { cacheEnabled: true, userId })
  }

  protected generateId(items: EmployeeConsumption[]): string {
    return `empcons-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find consumptions by employee ID
   */
  async findByEmployeeId(employeeId: string): Promise<EmployeeConsumption[]> {
    return this.query({ employeeId } as Partial<EmployeeConsumption>)
  }

  /**
   * Find consumptions by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<EmployeeConsumption[]> {
    const consumptions = await this.getAll()
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    return consumptions.filter(c => {
      const date = new Date(c.timestamp)
      return date >= start && date <= end
    })
  }

  /**
   * Get total consumption value for an employee
   */
  async getTotalByEmployeeId(employeeId: string): Promise<number> {
    const consumptions = await this.findByEmployeeId(employeeId)
    return consumptions.reduce((sum, c) => 
      sum + c.items.reduce((itemSum, item) => 
        itemSum + (item.unitPrice * item.quantity), 0
      ), 0
    )
  }
}
