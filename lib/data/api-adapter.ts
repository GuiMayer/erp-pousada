import { ApiError, changedFields, rememberRows, reviewConflict, type Row } from "./conflicts"
import type { IStorageAdapter } from "./types"
export interface ApiAdapterOptions {
  baseUrl: string
  token?: string
  timeout?: number
}
/**
 * API Storage Adapter
 *
 * Stores data on a remote server via REST API.
 *
 * @example
 * ```typescript
 * const adapter = new ApiAdapter({
 *   baseUrl: 'https://api.pousada.com',
 *   token: 'your-auth-token'
 * })
 * ```
 */
export class ApiAdapter implements IStorageAdapter {
  private baseUrl: string
  private token?: string
  private timeout: number
  private pendingCreates = new Map<string, { requestId: string; value: unknown }>()
  constructor(options: ApiAdapterOptions) {
    this.baseUrl = options.baseUrl
    this.token = options.token
    this.timeout = options.timeout || 5000
  }
  hasItemEndpoints(): boolean {
    return true
  }
  /**
   * Get data from API
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeout)
      })
      if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:session-expired"))
    if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        if (response.status === 403 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:permissions-changed"))
        const failure = await response.json().catch(() => ({}))
        throw new ApiError(failure.error || `API error: ${response.status} ${response.statusText}`, response.status, failure.code)
      }
      const result = await response.json()
      rememberRows(key, Array.isArray(result) ? result : [result])
      return result
    } catch (error) {
      console.error(`[ApiAdapter] Error getting ${key}:`, error)
      throw error
    }
  }
  /**
   * Set data on API
   */
  async set<T>(key: string, value: T): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(value),
        signal: AbortSignal.timeout(this.timeout)
      })
      if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:session-expired"))
    if (!response.ok) {
        if (response.status === 403 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:permissions-changed"))
        const failure = await response.json().catch(() => ({}))
        throw new ApiError(failure.error || `API error: ${response.status} ${response.statusText}`, response.status, failure.code)
      }
    } catch (error) {
      console.error(`[ApiAdapter] Error setting ${key}:`, error)
      throw error
    }
  }
  async createItem<T>(key: string, value: T): Promise<T> {
    const row = value as Record<string, unknown>
    const intention = JSON.stringify({ key, value: Object.fromEntries(Object.entries(row).filter(([field]) => !["id", "createdAt", "createdBy"].includes(field))) })
    const pending = this.pendingCreates.get(intention) ?? { requestId: crypto.randomUUID(), value }
    const { requestId } = pending
    this.pendingCreates.set(intention, pending)
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(key)}/items`, {
      method: 'POST',
      headers: { ...this.getHeaders(), "Idempotency-Key": requestId },
      body: JSON.stringify(pending.value),
      signal: AbortSignal.timeout(this.timeout)
    })
    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:session-expired"))
    if (!response.ok) {
      if (response.status === 403 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:permissions-changed"))
        const failure = await response.json().catch(() => ({}))
        throw new ApiError(failure.error || `API error: ${response.status} ${response.statusText}`, response.status, failure.code)
    }
    const result = await response.json()
    this.pendingCreates.delete(intention)
      rememberRows(key, Array.isArray(result) ? result : [result])
      return result
  }
  async updateItem<T>(key: string, id: string | number, value: Partial<T>): Promise<T> {
    let draft = changedFields(key, id, value as Row)
    for (;;) {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(key)}/items/${encodeURIComponent(String(id))}`, {
        method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify(draft), signal: AbortSignal.timeout(this.timeout)
      })
      const result = await response.json()
      if (response.ok) { rememberRows(key, [result]); return result }
      if (response.status === 401) window.dispatchEvent(new Event("erp:session-expired"))
      if (response.status === 403) window.dispatchEvent(new Event("erp:permissions-changed"))
      if (result.code !== "STALE_VERSION") throw new ApiError(result.error || "Não foi possível salvar", response.status, result.code)
      const current = await fetch(`${this.baseUrl}/${encodeURIComponent(key)}/items/${encodeURIComponent(String(id))}`, { headers: this.getHeaders(), cache: "no-store" })
      const latest = await current.json()
      if (!current.ok) throw new ApiError(latest.error || "Registro indisponível", current.status, latest.code)
      draft = await reviewConflict(key, draft, latest)
      // Every retry follows an explicit review and uses the newly read version.
    }
  }
  async deleteItem(key: string, id: string | number, expectedVersion?: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(key)}/items/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      headers: { ...this.getHeaders(), ...(expectedVersion === undefined ? {} : { "If-Match": String(expectedVersion) }) },
      signal: AbortSignal.timeout(this.timeout)
    })
    if (!response.ok) {
      if (response.status === 403 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:permissions-changed"))
        const failure = await response.json().catch(() => ({}))
        throw new ApiError(failure.error || `API error: ${response.status} ${response.statusText}`, response.status, failure.code)
    }
  }
  /**
   * Remove data from API
   */
  async remove(key: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeout)
      })
      if (!response.ok && response.status !== 404) {
        if (response.status === 403 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:permissions-changed"))
        const failure = await response.json().catch(() => ({}))
        throw new ApiError(failure.error || `API error: ${response.status} ${response.statusText}`, response.status, failure.code)
      }
    } catch (error) {
      console.error(`[ApiAdapter] Error removing ${key}:`, error)
      throw error
    }
  }
  /**
   * Clear all data from API
   */
  async clear(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/clear`, {
        method: 'POST',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeout)
      })
      if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:session-expired"))
    if (!response.ok) {
        if (response.status === 403 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:permissions-changed"))
        const failure = await response.json().catch(() => ({}))
        throw new ApiError(failure.error || `API error: ${response.status} ${response.statusText}`, response.status, failure.code)
      }
    } catch (error) {
      console.error(`[ApiAdapter] Error clearing data:`, error)
      throw error
    }
  }
  /**
   * Get all keys from API
   */
  async keys(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/keys`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeout)
      })
      if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:session-expired"))
    if (!response.ok) {
        if (response.status === 403 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:permissions-changed"))
        const failure = await response.json().catch(() => ({}))
        throw new ApiError(failure.error || `API error: ${response.status} ${response.statusText}`, response.status, failure.code)
      }
      const result = await response.json()
      return result
    } catch (error) {
      console.error(`[ApiAdapter] Error getting keys:`, error)
      throw error
    }
  }
  /**
   * Export all data from API
   */
  async export(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/export`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeout * 2) // Longer timeout for export
      })
      if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:session-expired"))
    if (!response.ok) {
        if (response.status === 403 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:permissions-changed"))
        const failure = await response.json().catch(() => ({}))
        throw new ApiError(failure.error || `API error: ${response.status} ${response.statusText}`, response.status, failure.code)
      }
      return await response.text()
    } catch (error) {
      console.error(`[ApiAdapter] Error exporting data:`, error)
      return '{}'
    }
  }
  /**
   * Import data to API
   */
  async import(json: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/import`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: json,
        signal: AbortSignal.timeout(this.timeout * 2) // Longer timeout for import
      })
      if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:session-expired"))
    if (!response.ok) {
        if (response.status === 403 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:permissions-changed"))
        const failure = await response.json().catch(() => ({}))
        throw new ApiError(failure.error || `API error: ${response.status} ${response.statusText}`, response.status, failure.code)
      }
    } catch (error) {
      console.error(`[ApiAdapter] Error importing data:`, error)
      throw error
    }
  }
  /**
   * Get storage usage from API
   */
  async getUsage(): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/usage`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeout)
      })
      if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:session-expired"))
    if (!response.ok) {
        if (response.status === 403 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:permissions-changed"))
        const failure = await response.json().catch(() => ({}))
        throw new ApiError(failure.error || `API error: ${response.status} ${response.statusText}`, response.status, failure.code)
      }
      const data = await response.json()
      return data.bytes || 0
    } catch (error) {
      console.error(`[ApiAdapter] Error getting usage:`, error)
      return 0
    }
  }
  /**
   * Get request headers
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }
}
