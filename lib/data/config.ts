/**
 * Data Layer Configuration
 *
 * Configures which storage adapter to use.
 * Allows switching between the production database path and demo storage.
 */

export type AdapterType = 'database' | 'demo-localStorage'

export interface DataConfig {
  /**
   * Which adapter to use
   * - 'database': Store business data on the server/database path
   * - 'demo-localStorage': Store demo data in browser localStorage only
   * - 'api': Store data on remote server via API
   */
  adapter: AdapterType

  /**
   * Storage key prefix (for localStorage)
   */
  prefix?: string

  /**
   * API base URL (for api adapter)
   */
  apiBaseUrl?: string

  /**
   * API authentication token (for api adapter)
   */
  apiToken?: string

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * Get data configuration from environment variables
 */
export function getDataConfig(): DataConfig {
  const adapterType = normalizeAdapterType(process.env.NEXT_PUBLIC_DATA_ADAPTER)

  return {
    adapter: adapterType,
    prefix: process.env.NEXT_PUBLIC_STORAGE_PREFIX || 'pousada',
    apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',

    debug: process.env.NEXT_PUBLIC_DEBUG === 'true'
  }
}

/**
 * Default configuration
 */
export const defaultConfig: DataConfig = {
  adapter: 'database',
  prefix: 'pousada',
  debug: false
}

function normalizeAdapterType(value: string | undefined): AdapterType {
  if (value === "api") throw new Error("Use o adaptador database com sessão autenticada")
  if (value === 'demo-localStorage' || value === 'database') {
    return value
  }

  if (value === 'localStorage') {
    return 'demo-localStorage'
  }

  return 'database'
}
