import { BaseRepository } from "./base-repository"
import type { RecurringTransaction } from "../../store"
import type { IStorageAdapter } from "../types"

export class RecurringTransactionRepository extends BaseRepository<RecurringTransaction> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "recurringTransactions", { cacheEnabled: true, userId })
  }

  protected generateId(items: RecurringTransaction[]): string {
    return `RT${String(items.length + 1).padStart(3, "0")}`
  }

  protected validate(transaction: Partial<RecurringTransaction>): { valid: boolean; error?: string } {
    if (transaction.description !== undefined && transaction.description.trim() === "") {
      return { valid: false, error: "Descricao e obrigatoria" }
    }
    if (transaction.value !== undefined && transaction.value <= 0) {
      return { valid: false, error: "Valor deve ser maior que zero" }
    }
    if (transaction.dayOfMonth !== undefined && (transaction.dayOfMonth < 1 || transaction.dayOfMonth > 31)) {
      return { valid: false, error: "Dia do mes deve estar entre 1 e 31" }
    }
    return { valid: true }
  }
}
