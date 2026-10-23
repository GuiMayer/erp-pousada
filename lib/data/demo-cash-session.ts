import type { DataStore } from "./types"
import { ApiError } from "./conflicts"

export async function touchDemoCash(store: DataStore, required = false) {
  const turn = (await store.cashCloses.getAll()).find(t => t.status === "aberto")
  if (!turn) {
    if (required) throw new ApiError("Caixa fechado — abra para vender ou lançar bebidas na hospedagem", 409, "CASH_CLOSED")
    return undefined
  }
  return store.cashCloses.update(turn.id, { recordVersion: (turn.recordVersion ?? 0) + 1 })
}
