/**
 * Data Layer Configuration
 * 
 * Configures which storage adapter to use.
 * Allows switching between localStorage and API backend.
 */

export type AdapterType = 'localStorage' | 'api'

export interface DataConfig {
  /**
   * Which adapter to use
   * - 'localStorage': Store data in browser localStorage
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
  // Check environment variable for adapter type
  const adapterType = (process.env.NEXT_PUBLIC_DATA_ADAPTER as AdapterType) || 'localStorage'
  
  return {
    adapter: adapterType,
    prefix: process.env.NEXT_PUBLIC_STORAGE_PREFIX || 'pousada',
    apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    apiToken: process.env.NEXT_PUBLIC_API_TOKEN,
    debug: process.env.NEXT_PUBLIC_DEBUG === 'true'
  }
}

/**
 * Default configuration
 */
export const defaultConfig: DataConfig = {
  adapter: 'localStorage',
  prefix: 'pousada',
  debug: false
}
