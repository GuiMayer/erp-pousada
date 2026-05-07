/**
 * useStorageSync Hook
 * 
 * Listens to storage events from other tabs and triggers re-sync.
 * Enables real-time synchronization across multiple browser tabs.
 */

import { useEffect, useState, useCallback } from "react"

export interface StorageSyncOptions {
  /**
   * Enable/disable sync (default: true)
   */
  enabled?: boolean

  /**
   * Debounce delay in ms (default: 100)
   */
  debounceMs?: number

  /**
   * Callback when sync event is detected
   */
  onSync?: (event: StorageSyncEvent) => void
}

export interface StorageSyncEvent {
  key: string
  action: 'create' | 'update' | 'delete' | 'clear'
  timestamp: number
}

/**
 * Hook for cross-tab storage synchronization
 * 
 * @example
 * ```typescript
 * const { isSyncing, lastSyncTime } = useStorageSync({
 *   enabled: true,
 *   onSync: (event) => {
 *     console.log('Storage changed in another tab:', event)
 *     // Reload data from storage
 *     loadData()
 *   }
 * })
 * ```
 */
export function useStorageSync(options: StorageSyncOptions = {}) {
  const {
    enabled = true,
    debounceMs = 100,
    onSync
  } = options

  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)

  const handleStorageEvent = useCallback((event: StorageEvent) => {
    if (!enabled) return

    // Only handle events from other tabs
    if (event.storageArea !== localStorage) return

    // Parse the key to extract entity name
    const key = event.key
    if (!key || !key.includes(':')) return

    setIsSyncing(true)
    const timestamp = Date.now()
    setLastSyncTime(timestamp)

    // Determine action based on old/new values
    let action: StorageSyncEvent['action'] = 'update'
    if (event.oldValue === null && event.newValue !== null) {
      action = 'create'
    } else if (event.oldValue !== null && event.newValue === null) {
      action = 'delete'
    }

    // Notify callback
    if (onSync) {
      onSync({ key, action, timestamp })
    }

    // Reset syncing state after debounce
    setTimeout(() => {
      setIsSyncing(false)
    }, debounceMs)
  }, [enabled, debounceMs, onSync])

  const handleCustomEvent = useCallback((event: Event) => {
    if (!enabled) return

    const customEvent = event as CustomEvent
    const detail = customEvent.detail

    if (!detail || !detail.entityName) return

    setIsSyncing(true)
    const timestamp = Date.now()
    setLastSyncTime(timestamp)

    // Notify callback
    if (onSync) {
      onSync({
        key: detail.entityName,
        action: detail.action || 'update',
        timestamp
      })
    }

    // Reset syncing state after debounce
    setTimeout(() => {
      setIsSyncing(false)
    }, debounceMs)
  }, [enabled, debounceMs, onSync])

  useEffect(() => {
    if (!enabled) return

    // Listen to native storage events (from other tabs)
    window.addEventListener('storage', handleStorageEvent)

    // Listen to custom repository events (from same tab)
    window.addEventListener('repository-change', handleCustomEvent)

    return () => {
      window.removeEventListener('storage', handleStorageEvent)
      window.removeEventListener('repository-change', handleCustomEvent)
    }
  }, [enabled, handleStorageEvent, handleCustomEvent])

  return {
    isSyncing,
    lastSyncTime
  }
}
