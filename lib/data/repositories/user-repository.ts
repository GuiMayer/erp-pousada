/**
 * User Repository
 *
 * Manages user data and authentication.
 */

import { BaseRepository } from "./base-repository"
import type { User } from "../../store"
import type { IStorageAdapter } from "../types"

export class UserRepository extends BaseRepository<User> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "users", { cacheEnabled: true, userId })
  }

  protected generateId(items: User[]): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  protected validate(user: Partial<User>): { valid: boolean; error?: string } {
    if (!user.username || user.username.trim().length === 0) {
      return { valid: false, error: "Username é obrigatório" }
    }
    if (user.password !== undefined && user.password.length < 12) {
      return { valid: false, error: "Senha deve ter no mínimo 12 caracteres" }
    }
    if (!user.role || !["operador", "supervisor"].includes(user.role)) {
      return { valid: false, error: "Role inválido" }
    }
    if (!user.fullName || user.fullName.trim().length === 0) {
      return { valid: false, error: "Nome completo é obrigatório" }
    }
    return { valid: true }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const users = await this.getAll()
    return users.find(u => u.username === username) ?? null
  }

  /**
   * Find active users
   */
  async findActive(): Promise<User[]> {
    return this.query({ active: true } as Partial<User>)
  }

  /**
   * Check if username is unique
   */
  async isUsernameUnique(username: string, excludeId?: string): Promise<boolean> {
    const users = await this.getAll()
    return !users.some(u => u.username === username && u.id !== excludeId)
  }

  /**
   * Authenticate user
   */
  async authenticate(): Promise<never> {
    throw new Error("Autenticação é realizada exclusivamente pelo servidor")
  }
}
