import type { RoomConsumption } from "../../store"
import type { IDataRepository, IStorageAdapter } from "../types"
export class ConsumptionRepository implements IDataRepository<RoomConsumption> {
  constructor(private adapter: IStorageAdapter, _userId?: string) {}
  async getAll() { return await this.adapter.get<RoomConsumption[]>("consumptions") ?? [] }
  async count() { return (await this.getAll()).length }
  async getById(id: string | number) { return this.getByRoomId(Number(id)) }
  async getByRoomId(id: number) { return (await this.getAll()).find(c => c.roomId === id) ?? null }
  async create(item: RoomConsumption) {
    const adapter = this.adapter as IStorageAdapter & { createItem?: <T>(key: string, item: T) => Promise<T> }
    if (adapter.createItem) return adapter.createItem("consumptions", item)
    const all = await this.getAll()
    if (all.some(c => c.roomId === item.roomId)) throw new Error("Consumo já cadastrado")
    await this.adapter.set("consumptions", [...all, item]); return item
  }
  async update(id: string | number, data: Partial<RoomConsumption>) {
    const current = await this.getById(id)
    if (!current) throw new Error("Consumo não encontrado")
    const adapter = this.adapter as IStorageAdapter & { updateItem?: <T>(key: string, id: string | number, data: Partial<T>) => Promise<T> }
    if (adapter.updateItem) return adapter.updateItem<RoomConsumption>("consumptions", id, data)
    const updated = { ...current, ...data, roomId: Number(id) }
    await this.adapter.set("consumptions", (await this.getAll()).map(c => c.roomId === Number(id) ? updated : c)); return updated
  }
  async delete(id: string | number) {
    const adapter = this.adapter as IStorageAdapter & { deleteItem?: (key: string, id: string | number) => Promise<void> }
    if (adapter.deleteItem) return adapter.deleteItem("consumptions", id)
    await this.adapter.set("consumptions", (await this.getAll()).filter(c => c.roomId !== Number(id)))
  }
  async clearByRoomId(id: number) { if (await this.getByRoomId(id)) await this.delete(id) }
  async upsertByRoomId(item: RoomConsumption) { return await this.getByRoomId(item.roomId) ? this.update(item.roomId, item) : this.create(item) }
  async query(filter: Partial<RoomConsumption>) { return (await this.getAll()).filter(c => Object.entries(filter).every(([k,v]) => c[k as keyof RoomConsumption] === v)) }
  async clear() { await this.adapter.set("consumptions", []) }
  async getTotalByRoomId(id: number) { return (await this.getByRoomId(id))?.items.reduce((sum,item) => sum + item.unitPrice * item.quantity,0) ?? 0 }
}
