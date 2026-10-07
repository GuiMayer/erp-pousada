/**
 * Transaction Repository
 *
 * Manages financial transaction data.
 */

import { BaseRepository } from "./base-repository"
import type { Transaction } from "../../store"
import type { IStorageAdapter } from "../types"
import { validateTransaction } from "../../utils/validators"
import { generateTransactionId } from "../../utils/id-generators"

export class TransactionRepository extends BaseRepository<Transaction> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "transactions", { cacheEnabled: true, userId })
  }

  protected generateId(items: Transaction[]): string {
    return generateTransactionId()
  }

  protected validate(transaction: Partial<Transaction>): { valid: boolean; error?: string } {
    return validateTransaction(transaction)
  }

  /**
   * Find transactions by type
   */
  async findByType(type: Transaction["type"]): Promise<Transaction[]> {
    return this.query({ type } as Partial<Transaction>)
  }

  /**
   * Find transactions by category
   */
  async findByCategory(category: string): Promise<Transaction[]> {
    return this.query({ category } as Partial<Transaction>)
  }

  /**
   * Find transactions by payment method
   */
  async findByPaymentMethod(paymentMethod: string): Promise<Transaction[]> {
    return this.query({ paymentMethod } as Partial<Transaction>)
  }

  /**
   * Find transactions by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
    const transactions = await this.getAll()
    const start = new Date(startDate)
    const end = new Date(endDate)

    return transactions.filter(t => {
      const date = new Date(t.date)
      return date >= start && date <= end
    })
  }

  /**
   * Calculate total by type
   */
  async getTotalByType(type: Transaction["type"]): Promise<number> {
    const transactions = await this.findByType(type)
    return transactions.reduce((sum, t) => sum + t.value, 0)
  }

  /**
   * Calculate balance (receitas - despesas)
   */
  async getBalance(): Promise<number> {
    const receitas = await this.getTotalByType("receita")
    const despesas = await this.getTotalByType("despesa")
    return receitas - despesas
  }
}
