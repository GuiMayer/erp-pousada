import { BaseRepository } from "./base-repository"
import type { BankTransfer } from "../../store"
import type { IStorageAdapter } from "../types"

export class BankTransferRepository extends BaseRepository<BankTransfer> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "bankTransfers", { cacheEnabled: true, userId })
  }

  protected generateId(items: BankTransfer[]): string {
    return `BT${String(items.length + 1).padStart(3, "0")}`
  }

  protected validate(transfer: Partial<BankTransfer>): { valid: boolean; error?: string } {
    if (transfer.value !== undefined && transfer.value <= 0) {
      return { valid: false, error: "Valor da transferencia deve ser maior que zero" }
    }
    if (transfer.fromAccountId && transfer.toAccountId && transfer.fromAccountId === transfer.toAccountId) {
      return { valid: false, error: "Contas de origem e destino devem ser diferentes" }
    }
    if (transfer.description !== undefined && transfer.description.trim() === "") {
      return { valid: false, error: "Descricao e obrigatoria" }
    }
    return { valid: true }
  }
}
