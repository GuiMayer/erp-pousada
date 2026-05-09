/**
 * Expense Repository
 * 
 * Manages expense data with validation and installment support.
 */

import { BaseRepository } from "./base-repository"
import type { Expense, ExpenseInstallment } from "../../store"
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

  /**
   * Find expenses with installments
   */
  async findWithInstallments(): Promise<Expense[]> {
    const expenses = await this.getAll()
    return expenses.filter(e => e.installments && e.installments.length > 0)
  }

  /**
   * Update a specific installment within an expense
   */
  async updateInstallment(
    expenseId: string,
    installmentId: string,
    updates: Partial<ExpenseInstallment>
  ): Promise<void> {
    const expense = await this.getById(expenseId)
    if (!expense) {
      throw new Error(`Expense ${expenseId} not found`)
    }

    if (!expense.installments || expense.installments.length === 0) {
      throw new Error(`Expense ${expenseId} has no installments`)
    }

    const installmentIndex = expense.installments.findIndex(i => i.id === installmentId)
    if (installmentIndex === -1) {
      throw new Error(`Installment ${installmentId} not found in expense ${expenseId}`)
    }

    // Update the installment
    expense.installments[installmentIndex] = {
      ...expense.installments[installmentIndex],
      ...updates
    }

    // Check if all installments are paid to update expense paid status
    const allPaid = expense.installments.every(i => i.paid)
    if (allPaid && !expense.paid) {
      expense.paid = true
      expense.paymentDate = new Date().toISOString().split("T")[0]
    } else if (!allPaid && expense.paid) {
      expense.paid = false
      expense.paymentDate = undefined
    }

    await this.update(expenseId, expense)
  }

  /**
   * Mark an installment as paid
   */
  async markInstallmentAsPaid(expenseId: string, installmentId: string): Promise<void> {
    await this.updateInstallment(expenseId, installmentId, {
      paid: true,
      paymentDate: new Date().toISOString().split("T")[0]
    })
  }

  /**
   * Get all installments across all expenses (flattened view)
   */
  async getAllInstallments(): Promise<Array<ExpenseInstallment & { expenseId: string; expenseDescription: string }>> {
    const expenses = await this.findWithInstallments()
    const installments: Array<ExpenseInstallment & { expenseId: string; expenseDescription: string }> = []

    for (const expense of expenses) {
      if (expense.installments) {
        for (const installment of expense.installments) {
          installments.push({
            ...installment,
            expenseId: expense.id,
            expenseDescription: expense.description
          })
        }
      }
    }

    return installments
  }

  /**
   * Find overdue installments
   */
  async findOverdueInstallments(): Promise<Array<ExpenseInstallment & { expenseId: string; expenseDescription: string }>> {
    const allInstallments = await this.getAllInstallments()
    const now = new Date()
    
    return allInstallments.filter(i => {
      if (i.paid) return false
      const dueDate = new Date(i.dueDate)
      return dueDate < now
    })
  }
}
