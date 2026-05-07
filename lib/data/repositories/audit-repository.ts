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
}
