/**
 * useDataStore Hook
 * 
 * Main hook for accessing the data layer.
 * Manages local state and synchronizes with repositories.
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import type { DataStore } from "../data/types"
import { createDataStore } from "../data/repositories"
import { getDataConfig } from "../data/config"
import { useStorageSync } from "./useStorageSync"

export interface UseDataStoreOptions {
  /**
   * User ID for metadata tracking
   */
  userId?: string

  /**
   * Enable cross-tab synchronization
   */
  enableSync?: boolean

  /**
   * Storage key prefix
   */
  prefix?: string
}

export interface UseDataStoreResult {
  /**
   * The data store instance
   */
  dataStore: DataStore

  /**
   * Whether data is being loaded from storage
   */
  isLoading: boolean

  /**
   * Whether data has been hydrated from storage
   */
  isHydrated: boolean

  /**
   * Whether data is being synced from another tab
   */
  isSyncing: boolean

  /**
   * Reload all data from storage
   */
  reload: () => Promise<void>

  /**
   * Export all data as JSON
   */
  exportData: () => Promise<string>

  /**
   * Import data from JSON
   */
  importData: (json: string) => Promise<void>

  /**
   * Clear all data
   */
  clearAllData: () => Promise<void>

  /**
   * Get storage usage
   */
  getStorageUsage: () => Promise<number>
}

/**
 * Hook for accessing the data store
 * 
 * @example
 * ```typescript
 * const { dataStore, isLoading, isHydrated } = useDataStore({
 *   userId: "user-123",
 *   enableSync: true
 * })
 * 
 * // Use repositories
 * const rooms = await dataStore.rooms.getAll()
 * await dataStore.rooms.create({ number: "101", ... })
 * ```
 */
export function useDataStore(options: UseDataStoreOptions = {}): UseDataStoreResult {
  const {
    userId,
    enableSync = true,
    prefix = "pousada"
  } = options

  // Create data store instance (memoized)
  const dataStore = useMemo(() => {
    const dataConfig = getDataConfig()
    if (dataConfig.adapter === "database") {
      console.warn("[useDataStore] Database mode is configured, but the UI still uses the temporary client storage adapter until the server data API is enabled.")
    }

    return createDataStore({
      prefix,
      userId,
      enableSync
    })
  }, [prefix, userId, enableSync])

  const [isLoading, setIsLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [reloadTrigger, setReloadTrigger] = useState(0)

  // Setup cross-tab sync
  const { isSyncing } = useStorageSync({
    enabled: enableSync,
    onSync: (event) => {
      // Trigger reload when data changes in another tab
      console.log('[useDataStore] Sync event detected:', event)
      setReloadTrigger(prev => prev + 1)
    }
  })

  // Reload data from storage
  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      // Invalidate all caches to force reload
      // This is a no-op since repositories will reload on next access
      console.log('[useDataStore] Reloading data from storage')
    } catch (error) {
      console.error('[useDataStore] Error reloading data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Export all data
  const exportData = useCallback(async () => {
    return dataStore.exportAll()
  }, [dataStore])

  // Import data
  const importData = useCallback(async (json: string) => {
    setIsLoading(true)
    try {
      await dataStore.importAll(json)
      setReloadTrigger(prev => prev + 1)
    } finally {
      setIsLoading(false)
    }
  }, [dataStore])

  // Clear all data
  const clearAllData = useCallback(async () => {
    setIsLoading(true)
    try {
      await dataStore.clearAll()
      setReloadTrigger(prev => prev + 1)
    } finally {
      setIsLoading(false)
    }
  }, [dataStore])

  // Get storage usage
  const getStorageUsage = useCallback(async () => {
    return dataStore.getStorageUsage()
  }, [dataStore])

  // Initial hydration
  useEffect(() => {
    if (!isHydrated) {
      setIsHydrated(true)
    }
  }, [isHydrated])

  // Reload on trigger
  useEffect(() => {
    if (reloadTrigger > 0) {
      reload()
    }
  }, [reloadTrigger, reload])

  return {
    dataStore,
    isLoading,
    isHydrated,
    isSyncing,
    reload,
    exportData,
    importData,
    clearAllData,
    getStorageUsage
  }
}
