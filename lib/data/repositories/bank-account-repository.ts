import { BaseRepository } from "./base-repository"
import type { BankAccount } from "../../store"
import type { IStorageAdapter } from "../types"

export class BankAccountRepository extends BaseRepository<BankAccount> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "bankAccounts", { cacheEnabled: true, userId })
  }

  protected generateId(items: BankAccount[]): string {
    return `BA${String(items.length + 1).padStart(3, "0")}`
  }

  protected validate(account: Partial<BankAccount>): { valid: boolean; error?: string } {
    if (account.name !== undefined && account.name.trim() === "") {
      return { valid: false, error: "Nome da conta e obrigatorio" }
    }
    if (account.initialBalance !== undefined && account.initialBalance < 0) {
      return { valid: false, error: "Saldo inicial nao pode ser negativo" }
    }
    if (account.currentBalance !== undefined && account.currentBalance < 0) {
      return { valid: false, error: "Saldo atual nao pode ser negativo" }
    }
    return { valid: true }
  }
}
