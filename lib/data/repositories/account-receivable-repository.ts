/**
 * Account Receivable Repository
 * 
 * Manages accounts receivable with validation and aging reports.
 */

import { BaseRepository } from "./base-repository"
import type { AccountReceivable } from "../../store"
import type { IStorageAdapter } from "../types"
import { generateAccountReceivableId } from "../../utils/id-generators"

export class AccountReceivableRepository extends BaseRepository<AccountReceivable> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "accountsReceivable", { cacheEnabled: true, userId })
  }

  protected generateId(items: AccountReceivable[]): string {
    return generateAccountReceivableId(items.length)
  }

  protected validate(ar: Partial<AccountReceivable>): { valid: boolean; error?: string } {
    if (ar.value !== undefined && ar.value <= 0) {
      return { valid: false, error: "Valor deve ser positivo" }
    }
    if (ar.customerName !== undefined && ar.customerName.trim() === "") {
      return { valid: false, error: "Nome do cliente é obrigatório" }
    }
    return { valid: true }
  }

  /**
   * Find overdue accounts receivable
   */
  async findOverdue(): Promise<AccountReceivable[]> {
    const items = await this.getAll()
    const now = new Date()
    return items.filter(ar => {
      if (ar.status === "pago" || ar.status === "cancelado") return false
      const dueDate = new Date(ar.dueDate)
      return dueDate < now
    })
  }

  /**
   * Find by status
   */
  async findByStatus(status: AccountReceivable["status"]): Promise<AccountReceivable[]> {
    return this.query({ status } as Partial<AccountReceivable>)
  }

  /**
   * Find by customer
   */
  async findByCustomer(customerId: string): Promise<AccountReceivable[]> {
    return this.query({ customerId } as Partial<AccountReceivable>)
  }

  /**
   * Get aging report (30/60/90 days)
   */
  async getAgingReport(): Promise<{
    current: number
    days30: number
    days60: number
    days90: number
    over90: number
  }> {
    const overdue = await this.findOverdue()
    const now = new Date()
    
    const aging = {
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      over90: 0
    }

    overdue.forEach(ar => {
      const dueDate = new Date(ar.dueDate)
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysOverdue <= 30) aging.days30 += ar.value
      else if (daysOverdue <= 60) aging.days60 += ar.value
      else if (daysOverdue <= 90) aging.days90 += ar.value
      else aging.over90 += ar.value
    })

    // Current (not overdue but pending)
    const pending = await this.findByStatus("pendente")
    pending.forEach(ar => {
      const dueDate = new Date(ar.dueDate)
      if (dueDate >= now) {
        aging.current += ar.value
      }
    })

    return aging
  }

  /**
   * Find by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<AccountReceivable[]> {
    const items = await this.getAll()
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    return items.filter(ar => {
      const dueDate = new Date(ar.dueDate)
      return dueDate >= start && dueDate <= end
    })
  }
}
