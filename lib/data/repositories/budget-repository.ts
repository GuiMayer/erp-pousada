import { BaseRepository } from "./base-repository"
import type { Budget } from "../../store"
import type { IStorageAdapter } from "../types"

export class BudgetRepository extends BaseRepository<Budget> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "budgets", { cacheEnabled: true, userId })
  }

  protected generateId(items: Budget[]): string {
    return `BUD${String(items.length + 1).padStart(3, "0")}`
  }

  protected validate(budget: Partial<Budget>): { valid: boolean; error?: string } {
    if (budget.name !== undefined && budget.name.trim() === "") {
      return { valid: false, error: "Nome do orcamento e obrigatorio" }
    }
    if (budget.year !== undefined && budget.year < 2000) {
      return { valid: false, error: "Ano do orcamento invalido" }
    }
    if (budget.month !== undefined && (budget.month < 1 || budget.month > 12)) {
      return { valid: false, error: "Mes do orcamento invalido" }
    }
    if (budget.categories?.some(category => category.plannedAmount < 0 || category.spentAmount < 0)) {
      return { valid: false, error: "Valores do orcamento nao podem ser negativos" }
    }
    return { valid: true }
  }
}
