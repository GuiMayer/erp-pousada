/**
 * Guest Repository
 * 
 * Manages guest profile data.
 */

import { BaseRepository } from "./base-repository"
import type { GuestProfile } from "../../store"
import type { IStorageAdapter } from "../types"

export class GuestRepository extends BaseRepository<GuestProfile> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "guests", { cacheEnabled: true, userId })
  }

  protected generateId(items: GuestProfile[]): string {
    return `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find guest by CPF
   */
  async findByCPF(cpf: string): Promise<GuestProfile | null> {
    const guests = await this.getAll()
    return guests.find(g => g.cpf === cpf) ?? null
  }

  /**
   * Find guests by name (partial match)
   */
  async findByName(name: string): Promise<GuestProfile[]> {
    const guests = await this.getAll()
    const searchTerm = name.toLowerCase()
    return guests.filter(g => 
      g.name.toLowerCase().includes(searchTerm)
    )
  }

  /**
   * Create or update guest (upsert by CPF)
   */
  async upsertByCPF(guest: Omit<GuestProfile, 'id'>): Promise<GuestProfile> {
    const existing = await this.findByCPF(guest.cpf)
    
    if (existing) {
      return this.update(existing.id, guest)
    } else {
      return this.create(guest)
    }
  }
}
