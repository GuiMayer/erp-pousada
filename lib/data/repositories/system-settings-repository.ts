/**
 * System Settings Repository
 * 
 * Manages system-wide configuration settings.
 * This is a singleton repository - only one settings record exists.
 */

import { BaseRepository } from "./base-repository"
import type { SystemSettings } from "../../store"
import type { IStorageAdapter } from "../types"

export class SystemSettingsRepository extends BaseRepository<SystemSettings> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "systemSettings", { cacheEnabled: true, userId })
  }

  protected generateId(items: SystemSettings[]): string {
    return "settings-1" // Singleton - always the same ID
  }

  protected validate(settings: Partial<SystemSettings>): { valid: boolean; error?: string } {
    if (settings.pousadaName !== undefined && settings.pousadaName.trim().length === 0) {
      return { valid: false, error: "Nome da pousada é obrigatório" }
    }
    if (settings.checkInTime && !/^\d{2}:\d{2}$/.test(settings.checkInTime)) {
      return { valid: false, error: "Horário de check-in inválido (use HH:mm)" }
    }
    if (settings.checkOutTime && !/^\d{2}:\d{2}$/.test(settings.checkOutTime)) {
      return { valid: false, error: "Horário de check-out inválido (use HH:mm)" }
    }
    if (settings.discountCeiling !== undefined && (settings.discountCeiling < 0 || settings.discountCeiling > 100)) {
      return { valid: false, error: "Teto de desconto deve estar entre 0 e 100" }
    }
    if (settings.cnpj && settings.cnpj.trim().length > 0) {
      // Remove non-numeric characters
      const cnpjNumbers = settings.cnpj.replace(/\D/g, '')
      if (cnpjNumbers.length !== 14) {
        return { valid: false, error: "CNPJ deve ter 14 dígitos" }
      }
    }
    return { valid: true }
  }

  /**
   * Get the system settings (singleton)
   */
  async get(): Promise<SystemSettings | null> {
    const settings = await this.getAll()
    return settings[0] ?? null
  }

  /**
   * Update system settings
   */
  async updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = await this.get()
    if (!current) {
      throw new Error("System settings not initialized")
    }
    return this.update(current.id, data)
  }
}
