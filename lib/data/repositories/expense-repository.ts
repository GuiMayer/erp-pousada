/**
 * Expense Repository
 * 
 * Manages expense data with validation.
 */

import { BaseRepository } from "./base-repository"
import type { Expense } from "../../store"
import type { IStorageAdapter } from "../types"
import { validateExpense } from "../../utils/validators"
import { generateExpenseId } from "../../utils/id-generators"

export class ExpenseRepository extends BaseRepository<Expense> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "expenses", { cacheEnabled: true, userId })
  }

  protected generateId(items: Expense[]): string {
    return generateExpenseId(items.length + 1)
  }

  protected validate(expense: Partial<Expense>): { valid: boolean; error?: string } {
    return validateExpense(expense)
  }

  /**
   * Find expenses by category
   */
  async findByCategory(category: string): Promise<Expense[]> {
    return this.query({ category } as Partial<Expense>)
  }

  /**
   * Find paid expenses
   */
  async findPaid(): Promise<Expense[]> {
    return this.query({ paid: true } as Partial<Expense>)
  }

  /**
   * Find unpaid expenses
   */
  async findUnpaid(): Promise<Expense[]> {
    return this.query({ paid: false } as Partial<Expense>)
  }

  /**
   * Find overdue expenses
   */
  async findOverdue(): Promise<Expense[]> {
    const expenses = await this.getAll()
    const now = new Date()
    
    return expenses.filter(e => {
      if (e.paid) return false
      const dueDate = new Date(e.dueDate)
      return dueDate < now
    })
  }

  /**
   * Find expenses by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<Expense[]> {
    const expenses = await this.getAll()
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    return expenses.filter(e => {
      const dueDate = new Date(e.dueDate)
      return dueDate >= start && dueDate <= end
    })
  }
}
