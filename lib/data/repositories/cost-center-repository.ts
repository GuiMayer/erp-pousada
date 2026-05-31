import { BaseRepository } from "./base-repository"
import type { CostCenter } from "../../store"
import type { IStorageAdapter } from "../types"

export class CostCenterRepository extends BaseRepository<CostCenter> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "costCenters", { cacheEnabled: true, userId })
  }

  protected generateId(items: CostCenter[]): string {
    return `CC${String(items.length + 1).padStart(3, "0")}`
  }

  protected validate(costCenter: Partial<CostCenter>): { valid: boolean; error?: string } {
    if (costCenter.name !== undefined && costCenter.name.trim() === "") {
      return { valid: false, error: "Nome do centro de custo e obrigatorio" }
    }
    return { valid: true }
  }
}
