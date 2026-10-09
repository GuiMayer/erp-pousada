import { BaseRepository } from "./base-repository"
import type { IStorageAdapter } from "../types"
import { tariffSchema, tariffsOverlap, type LodgingTariff } from "@/lib/lodging-pricing"

export class LodgingTariffRepository extends BaseRepository<LodgingTariff> {
  constructor(adapter: IStorageAdapter, userId?: string) { super(adapter, "lodgingTariffs", { userId }) }
  protected generateId() { return crypto.randomUUID() }
  async create(item: Partial<LodgingTariff>) {
    const tariff = tariffSchema.parse({ ...item, id: item.id || this.generateId() })
    if (!this.getItemAdapter() && (await this.getAll()).some(t => tariffsOverlap(tariff, t))) throw new Error("Tarifa sobrepõe outra da mesma ocupação e vigência")
    return super.create(tariff)
  }
  async update(id: string, updates: Partial<LodgingTariff>) {
    if (!this.getItemAdapter()) {
      const current = await this.getById(id)
      const tariff = tariffSchema.parse({ ...current, ...updates })
      if ((await this.getAll()).some(t => t.id !== id && tariffsOverlap(tariff, t))) throw new Error("Tarifas conflitantes")
    }
    return super.update(id, updates)
  }
}
