/**
 * Base Repository
 *
 * Abstract base class that implements common CRUD operations for all repositories.
 * Handles caching, validation, event emission, and metadata management.
 */

import type { IDataRepository, IStorageAdapter, EntityMetadata } from "../types"

type ItemEndpointAdapter = IStorageAdapter & {
  createItem<T>(key: string, value: T): Promise<T>
  updateItem<T>(key: string, id: string | number, value: Partial<T>): Promise<T>
  deleteItem(key: string, id: string | number, expectedVersion?: number): Promise<void>
  hasItemEndpoints?(): boolean
}

/**
 * Event listener for repository changes
 */
export type RepositoryEventListener = (event: {
  action: 'create' | 'update' | 'delete' | 'clear'
  id?: string | number
  data?: any
}) => void

/**
 * Base repository implementation
 */
export abstract class BaseRepository<T extends { id: string | number }> implements IDataRepository<T> {
  protected adapter: IStorageAdapter
  protected entityName: string
  protected cache: Map<string | number, T> = new Map()
  protected cacheEnabled: boolean
  protected listeners: Set<RepositoryEventListener> = new Set()
  protected userId?: string

  constructor(
    adapter: IStorageAdapter,
    entityName: string,
    options: {
      cacheEnabled?: boolean
      userId?: string
    } = {}
  ) {
    this.adapter = adapter
    this.entityName = entityName
    this.cacheEnabled = typeof (adapter as { createItem?: unknown }).createItem === "function" ? false : options.cacheEnabled ?? true
    this.userId = options.userId
  }

  /**
   * Get storage key for this entity
   */
  protected getStorageKey(): string {
    return this.entityName
  }

  /**
   * Load all items from storage
   */
  protected async loadFromStorage(): Promise<T[]> {
    const data = await this.adapter.get<T[]>(this.getStorageKey())
    return data ?? []
  }

  /**
   * Save all items to storage
   */
  protected async saveToStorage(items: T[]): Promise<void> {
    await this.adapter.set(this.getStorageKey(), items)
  }

  protected getItemAdapter(): ItemEndpointAdapter | null {
    const adapter = this.adapter as Partial<ItemEndpointAdapter>
    if (typeof adapter.createItem !== "function" || typeof adapter.updateItem !== "function" || typeof adapter.deleteItem !== "function") {
      return null
    }

    if (typeof adapter.hasItemEndpoints === "function" && !adapter.hasItemEndpoints()) {
      return null
    }

    return this.adapter as ItemEndpointAdapter
  }

  /**
   * Invalidate cache
   */
  protected invalidateCache(): void {
    this.cache.clear()
  }

  /**
   * Update cache with items
   */
  protected updateCache(items: T[]): void {
    if (!this.cacheEnabled) return

    this.cache.clear()
    for (const item of items) {
      this.cache.set(item.id, item)
    }
  }

  /**
   * Emit event to listeners
   */
  protected emit(event: {
    action: 'create' | 'update' | 'delete' | 'clear'
    id?: string | number
    data?: any
  }): void {
    for (const listener of this.listeners) {
      listener(event)
    }

    // Emit storage event for cross-tab sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('repository-change', {
        detail: {
          entityName: this.entityName,
          ...event
        }
      }))
    }
  }

  /**
   * Add event listener
   */
  public on(listener: RepositoryEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Validate item before mutation (override in subclasses)
   */
  protected validate(item: Partial<T>): { valid: boolean; error?: string } {
    return { valid: true }
  }

  /**
   * Add metadata to entity
   */
  protected addMetadata<E extends T>(item: E): E & Partial<EntityMetadata> {
    if (!this.userId) return item

    const now = new Date().toISOString()
    const existing = item as any

    return {
      ...item,
      _lastModified: now,
      _modifiedBy: this.userId,
      _version: (existing._version ?? 0) + 1
    }
  }

  /**
   * Generate ID for new item (override in subclasses if needed)
   */
  protected abstract generateId(items: T[]): string | number

  /**
   * Get all items
   */
  async getAll(): Promise<T[]> {
    // Check cache first
    if (this.cacheEnabled && this.cache.size > 0) {
      return Array.from(this.cache.values())
    }

    const items = await this.loadFromStorage()
    this.updateCache(items)
    return items
  }

  /**
   * Get item by ID
   */
  async getById(id: string | number): Promise<T | null> {
    // Check cache first
    if (this.cacheEnabled && this.cache.has(id)) {
      return this.cache.get(id) ?? null
    }

    const items = await this.getAll()
    return items.find(item => item.id === id) ?? null
  }

  /**
   * Create new item
   */
  async create(item: Omit<T, 'id'>): Promise<T> {
    // Validate
    const validation = this.validate(item as Partial<T>)
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.error}`)
    }

    // Load existing items
    const items = await this.loadFromStorage()

    // Generate ID
    const id = (item as Partial<T>).id || this.generateId(items)

    // Create new item with ID and metadata
    const newItem = this.addMetadata({
      ...item,
      id
    } as T)

    const itemAdapter = this.getItemAdapter()
    if (itemAdapter) {
      const created = await itemAdapter.createItem<T>(this.getStorageKey(), newItem)
      this.invalidateCache()
      this.emit({ action: 'create', id: created.id, data: created })
      return created
    }

    // Add to items
    items.push(newItem)

    // Save
    await this.saveToStorage(items)

    // Update cache
    if (this.cacheEnabled) {
      this.cache.set(id, newItem)
    }

    // Emit event
    this.emit({ action: 'create', id, data: newItem })

    return newItem
  }

  /**
   * Update existing item
   */
  async update(id: string | number, data: Partial<T>): Promise<T> {
    // Validate
    const existing = await this.getById(id)
    if (!existing) throw new Error(`Item with id ${id} not found`)
    const validation = this.validate({ ...existing, ...data })
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.error}`)
    }

    const itemAdapter = this.getItemAdapter()
    if (itemAdapter) {
      const updated = await itemAdapter.updateItem<T>(this.getStorageKey(), id, data)
      this.invalidateCache()
      this.emit({ action: 'update', id, data: updated })
      return updated
    }

    // Load existing items
    const items = await this.loadFromStorage()

    // Find item
    const index = items.findIndex(item => item.id === id)
    if (index === -1) {
      throw new Error(`Item with id ${id} not found`)
    }

    // Update item with metadata
    const updatedItem = this.addMetadata({
      ...items[index],
      ...data,
      id // Ensure ID doesn't change
    })

    items[index] = updatedItem

    // Save
    await this.saveToStorage(items)

    // Update cache
    if (this.cacheEnabled) {
      this.cache.set(id, updatedItem)
    }

    // Emit event
    this.emit({ action: 'update', id, data: updatedItem })

    return updatedItem
  }

  /**
   * Delete item
   */
  async delete(id: string | number, expectedVersion?: number): Promise<void> {
    const itemAdapter = this.getItemAdapter()
    if (itemAdapter) {
      await itemAdapter.deleteItem(this.getStorageKey(), id, expectedVersion)
      this.invalidateCache()
      this.emit({ action: 'delete', id })
      return
    }

    // Load existing items
    const items = await this.loadFromStorage()

    // Filter out item
    const filtered = items.filter(item => item.id !== id)

    if (filtered.length === items.length) {
      throw new Error(`Item with id ${id} not found`)
    }

    // Save
    await this.saveToStorage(filtered)

    // Update cache
    if (this.cacheEnabled) {
      this.cache.delete(id)
    }

    // Emit event
    this.emit({ action: 'delete', id })
  }

  /**
   * Query items by filter
   */
  async query(filter: Partial<T>): Promise<T[]> {
    const items = await this.getAll()

    // Simple filter implementation
    return items.filter(item => {
      for (const [key, value] of Object.entries(filter)) {
        if ((item as any)[key] !== value) {
          return false
        }
      }
      return true
    })
  }

  /**
   * Clear all items
   */
  async clear(): Promise<void> {
    await this.saveToStorage([])
    this.invalidateCache()
    this.emit({ action: 'clear' })
  }

  /**
   * Count items
   */
  async count(): Promise<number> {
    const items = await this.getAll()
    return items.length
  }

  /**
   * Check if item exists
   */
  async exists(id: string | number): Promise<boolean> {
    const item = await this.getById(id)
    return item !== null
  }
}
