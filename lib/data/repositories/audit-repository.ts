/**
 * Audit Log Repository
 * 
 * Manages audit log entries for tracking system changes.
 */

import { BaseRepository } from "./base-repository"
import type { AuditEntry } from "../../store"
import type { IStorageAdapter } from "../types"

export class AuditRepository extends BaseRepository<AuditEntry> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "auditLog", { cacheEnabled: false, userId }) // Disable cache for audit logs
  }

  protected generateId(items: AuditEntry[]): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find audit entries by user
   */
  async findByUser(user: string): Promise<AuditEntry[]> {
    return this.query({ user } as Partial<AuditEntry>)
  }

  /**
   * Find audit entries by action
   */
  async findByAction(action: string): Promise<AuditEntry[]> {
    return this.query({ action } as Partial<AuditEntry>)
  }

  /**
   * Find audit entries by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<AuditEntry[]> {
    const entries = await this.getAll()
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    return entries.filter(e => {
      const date = new Date(e.date)
      return date >= start && date <= end
    })
  }

  /**
   * Get recent entries (last N)
   */
  async getRecent(limit: number = 50): Promise<AuditEntry[]> {
    const entries = await this.getAll()
    return entries
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)
  }

  /**
   * Audit entries are immutable and cannot be modified
   * @throws Error always - audit entries cannot be updated
   */
  async update(id: string | number, data: Partial<AuditEntry>): Promise<AuditEntry> {
    throw new Error('Audit entries are immutable and cannot be modified')
  }

  /**
   * Audit entries are immutable and cannot be deleted
   * @throws Error always - audit entries cannot be deleted
   */
  async delete(id: string | number): Promise<void> {
    throw new Error('Audit entries are immutable and cannot be deleted')
  }

  /**
   * Audit log cannot be cleared in production
   * Only allowed for testing/development with explicit force flag
   * @throws Error if force flag is not provided
   */
  async clear(options?: { force?: boolean }): Promise<void> {
    if (!options?.force) {
      throw new Error('Audit log cannot be cleared. Use clear({ force: true }) only in development.')
    }
    
    // Log warning when force clearing
    console.warn('⚠️ AUDIT LOG CLEARED - This should only happen in development!')
    
    await super.clear()
  }
}
