/**
 * API Storage Adapter (Stub)
 *
 * Future implementation for storing data on a remote server.
 * Currently returns empty data - to be implemented when backend is ready.
 */

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
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
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
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error(`[ApiAdapter] Error setting ${key}:`, error)
      throw error
    }
  }

  async createItem<T>(key: string, value: T): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(key)}/items`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(this.timeout)
    })

    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:session-expired"))
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  async updateItem<T>(key: string, id: string | number, value: Partial<T>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(key)}/items/${encodeURIComponent(String(id))}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(this.timeout)
    })

    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("erp:session-expired"))
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  async deleteItem(key: string, id: string | number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(key)}/items/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(this.timeout)
    })

    if (!response.ok && response.status !== 404) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
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
        throw new Error(`API error: ${response.status} ${response.statusText}`)
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
        throw new Error(`API error: ${response.status} ${response.statusText}`)
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
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
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
        throw new Error(`API error: ${response.status} ${response.statusText}`)
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
        throw new Error(`API error: ${response.status} ${response.statusText}`)
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
        throw new Error(`API error: ${response.status} ${response.statusText}`)
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
