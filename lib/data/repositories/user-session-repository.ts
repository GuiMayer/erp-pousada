/**
 * User Session Repository
 * 
 * Manages user login/logout sessions for audit purposes.
 */

import { BaseRepository } from "./base-repository"
import type { UserSession } from "../../store"
import type { IStorageAdapter } from "../types"

export class UserSessionRepository extends BaseRepository<UserSession> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "userSessions", { cacheEnabled: true, userId })
  }

  protected generateId(items: UserSession[]): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  protected validate(session: Partial<UserSession>): { valid: boolean; error?: string } {
    if (!session.userId) {
      return { valid: false, error: "User ID é obrigatório" }
    }
    if (!session.username) {
      return { valid: false, error: "Username é obrigatório" }
    }
    if (!session.loginTime) {
      return { valid: false, error: "Login time é obrigatório" }
    }
    return { valid: true }
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(userId: string): Promise<UserSession[]> {
    const sessions = await this.getAll()
    return sessions.filter(s => s.userId === userId).sort((a, b) => 
      new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime()
    )
  }

  /**
   * Find active sessions (no logout time)
   */
  async findActive(): Promise<UserSession[]> {
    const sessions = await this.getAll()
    return sessions.filter(s => !s.logoutTime)
  }

  /**
   * Get recent sessions
   */
  async getRecent(limit: number = 10): Promise<UserSession[]> {
    const sessions = await this.getAll()
    return sessions
      .sort((a, b) => new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime())
      .slice(0, limit)
  }
}
