/**
 * Guest Repository
 *
 * Guest profiles use CPF as the natural key because GuestProfile has no id field.
 */

import type { GuestProfile } from "../../store"
import type { IDataRepository, IStorageAdapter } from "../types"

export class GuestRepository implements IDataRepository<GuestProfile> {
  constructor(
    private readonly adapter: IStorageAdapter,
    private readonly userId?: string
  ) {}

  private getStorageKey(): string {
    return "guests"
  }

  private async loadFromStorage(): Promise<GuestProfile[]> {
    return await this.adapter.get<GuestProfile[]>(this.getStorageKey()) ?? []
  }

  private async saveToStorage(guests: GuestProfile[]): Promise<void> {
    await this.adapter.set(this.getStorageKey(), guests)
  }

  async count() { return (await this.getAll()).length }

  async getAll(): Promise<GuestProfile[]> {
    return this.loadFromStorage()
  }

  async getById(cpf: string | number): Promise<GuestProfile | null> {
    return this.findByCPF(String(cpf))
  }

  async create(guest: GuestProfile): Promise<GuestProfile> {
    const guests = await this.loadFromStorage()
    const existing = guests.find(item => item.cpf === guest.cpf)
    if (existing) {
      throw new Error("Hospede ja cadastrado para este CPF")
    }

    const itemAdapter = this.adapter as IStorageAdapter & { createItem?: <T>(key: string, item: T) => Promise<T> }
    if (itemAdapter.createItem) return itemAdapter.createItem("guests", guest)
    guests.push(guest)
    await this.saveToStorage(guests)
    return guest
  }

  async update(cpf: string | number, data: Partial<GuestProfile>): Promise<GuestProfile> {
    const guests = await this.loadFromStorage()
    const index = guests.findIndex(item => item.cpf === String(cpf))
    if (index === -1) {
      throw new Error("Hospede nao encontrado")
    }

    const itemAdapter = this.adapter as IStorageAdapter & { updateItem?: <T>(key: string, id: string, data: Partial<T>) => Promise<T> }
    if (itemAdapter.updateItem) return itemAdapter.updateItem("guests", String(cpf), data)
    const updated = { ...guests[index], ...data, cpf: guests[index].cpf }
    guests[index] = updated
    await this.saveToStorage(guests)
    return updated
  }

  async delete(cpf: string | number): Promise<void> {
    const adapter = this.adapter as IStorageAdapter & { deleteItem?: (key: string, id: string) => Promise<void> }
    if (adapter.deleteItem) { await adapter.deleteItem("guests", String(cpf)); return }
    const guests = await this.loadFromStorage()
    await this.saveToStorage(guests.filter(item => item.cpf !== String(cpf)))
  }

  async query(filter: Partial<GuestProfile>): Promise<GuestProfile[]> {
    const guests = await this.loadFromStorage()
    return guests.filter(guest =>
      Object.entries(filter).every(([key, value]) => guest[key as keyof GuestProfile] === value)
    )
  }

  async clear(): Promise<void> {
    await this.saveToStorage([])
  }

  async findByCPF(cpf: string): Promise<GuestProfile | null> {
    const guests = await this.loadFromStorage()
    return guests.find(g => g.cpf === cpf) ?? null
  }

  async findByName(name: string): Promise<GuestProfile[]> {
    const guests = await this.loadFromStorage()
    const searchTerm = name.toLowerCase()
    return guests.filter(g => g.name.toLowerCase().includes(searchTerm))
  }

  async upsertByCPF(guest: GuestProfile): Promise<GuestProfile> {
    const existing = await this.findByCPF(guest.cpf)
    return existing ? this.update(existing.cpf, guest) : this.create(guest)
  }
}
