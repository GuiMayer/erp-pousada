/**
 * Expense Category Repository
 * 
 * Manages expense categories.
 */

import { BaseRepository } from "./base-repository"
import type { ExpenseCategory } from "../../store"
import type { IStorageAdapter } from "../types"

export class CategoryRepository extends BaseRepository<ExpenseCategory> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "categories", { cacheEnabled: true, userId })
  }

  protected generateId(items: ExpenseCategory[]): string {
    return `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find category by label
   */
  async findByLabel(label: string): Promise<ExpenseCategory | null> {
    const categories = await this.getAll()
    return categories.find(c => c.label === label) ?? null
  }
}
