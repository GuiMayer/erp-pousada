/**
 * LocalStorage Adapter
 * 
 * Implements the IStorageAdapter interface using browser localStorage.
 * Handles serialization, debouncing, quota management, and error handling.
 */

import type { IStorageAdapter } from "./types"

/**
 * Debounce helper for write operations
 */
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * LocalStorage adapter with debouncing and error handling
 */
export class LocalStorageAdapter implements IStorageAdapter {
  private prefix: string
  private writeQueue: Map<string, any> = new Map()
  private debouncedFlush: () => void

  constructor(prefix: string = "pousada", debounceMs: number = 100) {
    this.prefix = prefix
    this.debouncedFlush = debounce(() => this.flush(), debounceMs)
  }

  /**
   * Get full key with prefix
   */
  private getKey(key: string): string {
    return `${this.prefix}:${key}`
  }

  /**
   * Check if we're in a browser environment
   */
  private isClient(): boolean {
    return typeof window !== "undefined" && typeof localStorage !== "undefined"
  }

  /**
   * Flush pending writes to localStorage
   */
  private flush(): void {
    if (!this.isClient()) return

    for (const [key, value] of this.writeQueue.entries()) {
      try {
        const fullKey = this.getKey(key)
        const serialized = JSON.stringify(value)
        localStorage.setItem(fullKey, serialized)
      } catch (error) {
        if (error instanceof Error && error.name === "QuotaExceededError") {
          console.error(`LocalStorage quota exceeded for key: ${key}`)
          // Try to free up space by removing oldest items (fire-and-forget)
          void this.cleanupOldData()
        } else {
          console.error(`Error writing to localStorage for key: ${key}`, error)
        }
      }
    }

    this.writeQueue.clear()
  }

  /**
   * Clean up old data to free space
   */
  private async cleanupOldData(): Promise<void> {
    if (!this.isClient()) return

    try {
      const keys = await this.keys()
      // Remove items that look like old audit logs or transactions
      const keysToRemove = keys.filter(k => 
        k.includes("audit") || k.includes("transaction")
      ).slice(0, 10) // Remove up to 10 old items

      for (const key of keysToRemove) {
        localStorage.removeItem(this.getKey(key))
      }
    } catch (error) {
      console.error("Error cleaning up old data", error)
    }
  }

  /**
   * Get data for a specific key
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isClient()) return null

    // Check write queue first
    if (this.writeQueue.has(key)) {
      return this.writeQueue.get(key) as T
    }

    try {
      const fullKey = this.getKey(key)
      const item = localStorage.getItem(fullKey)
      
      if (item === null) {
        return null
      }

      return JSON.parse(item) as T
    } catch (error) {
      console.error(`Error reading from localStorage for key: ${key}`, error)
      return null
    }
  }

  /**
   * Set data for a specific key (debounced)
   */
  async set<T>(key: string, value: T): Promise<void> {
    if (!this.isClient()) return

    // Add to write queue
    this.writeQueue.set(key, value)
    
    // Trigger debounced flush
    this.debouncedFlush()
  }

  /**
   * Remove data for a specific key
   */
  async remove(key: string): Promise<void> {
    if (!this.isClient()) return

    // Remove from write queue if pending
    this.writeQueue.delete(key)

    try {
      const fullKey = this.getKey(key)
      localStorage.removeItem(fullKey)
    } catch (error) {
      console.error(`Error removing from localStorage for key: ${key}`, error)
    }
  }

  /**
   * Clear all data with this prefix
   */
  async clear(): Promise<void> {
    if (!this.isClient()) return

    this.writeQueue.clear()

    try {
      const keys = await this.keys()
      for (const key of keys) {
        localStorage.removeItem(key)
      }
    } catch (error) {
      console.error("Error clearing localStorage", error)
    }
  }

  /**
   * Get all keys with this prefix
   */
  async keys(): Promise<string[]> {
    if (!this.isClient()) return []

    const keys: string[] = []
    const prefixWithColon = `${this.prefix}:`

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(prefixWithColon)) {
          keys.push(key)
        }
      }
    } catch (error) {
      console.error("Error getting localStorage keys", error)
    }

    return keys
  }

  /**
   * Export all data as JSON
   */
  async export(): Promise<string> {
    if (!this.isClient()) return "{}"

    // Flush pending writes first
    this.flush()

    const data: Record<string, any> = {}
    const keys = await this.keys()

    for (const fullKey of keys) {
      try {
        const item = localStorage.getItem(fullKey)
        if (item) {
          // Remove prefix from key for export
          const key = fullKey.replace(`${this.prefix}:`, "")
          data[key] = JSON.parse(item)
        }
      } catch (error) {
        console.error(`Error exporting key: ${fullKey}`, error)
      }
    }

    return JSON.stringify(data, null, 2)
  }

  /**
   * Import data from JSON
   */
  async import(json: string): Promise<void> {
    if (!this.isClient()) return

    try {
      const data = JSON.parse(json)

      // Clear existing data first
      await this.clear()

      // Import new data
      for (const [key, value] of Object.entries(data)) {
        await this.set(key, value)
      }

      // Flush immediately
      this.flush()
    } catch (error) {
      console.error("Error importing data", error)
      throw new Error("Failed to import data: invalid JSON format")
    }
  }

  /**
   * Get storage usage in bytes
   */
  async getUsage(): Promise<number> {
    if (!this.isClient()) return 0

    let totalBytes = 0
    const keys = await this.keys()

    for (const key of keys) {
      try {
        const item = localStorage.getItem(key)
        if (item) {
          // Calculate size: key + value in UTF-16 (2 bytes per char)
          totalBytes += (key.length + item.length) * 2
        }
      } catch (error) {
        console.error(`Error calculating size for key: ${key}`, error)
      }
    }

    return totalBytes
  }

  /**
   * Get storage usage as human-readable string
   */
  async getUsageFormatted(): Promise<string> {
    const bytes = await this.getUsage()
    
    if (bytes < 1024) {
      return `${bytes} B`
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }
  }

  /**
   * Check if storage is near quota (>80%)
   */
  async isNearQuota(): Promise<boolean> {
    const usage = await this.getUsage()
    const quota = 5 * 1024 * 1024 // Assume 5MB quota (conservative estimate)
    return usage > quota * 0.8
  }
}
