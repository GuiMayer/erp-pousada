/**
 * Data Layer Types
 * 
 * This file defines the core interfaces for the data abstraction layer.
 * The repository pattern allows us to switch between localStorage and a real backend
 * without changing component code.
 */

import type {
  Room, Reservation, GuestProfile, Expense, Transaction, AuditEntry,
  ExpenseCategory, CashClose, RoomConsumption, POSProduct, POSSale,
  RestaurantTable, RestaurantOrder, StockItem, StockMovement,
  Recipe, Production, Employee, EmployeeConsumption, ProductCategory,
  User, UserSession, SystemSettings, Supplier, Customer, AccountReceivable,
  BankAccount, BankTransfer, CostCenter, Budget, RecurringTransaction
} from "../store"

/**
 * Generic repository interface for CRUD operations
 * All repositories implement this interface for consistency
 */
export interface IDataRepository<T> {
  /**
   * Get all items
   */
  getAll(): Promise<T[]>

  /**
   * Get a single item by ID
   */
  getById(id: string | number): Promise<T | null>

  /**
   * Create a new item
   */
  create(item: T): Promise<T>

  /**
   * Update an existing item
   */
  update(id: string | number, data: Partial<T>): Promise<T>

  /**
   * Delete an item
   */
  delete(id: string | number): Promise<void>

  /**
   * Query items by filter
   */
  query(filter: Partial<T>): Promise<T[]>

  /**
   * Clear all items (useful for testing and reset)
   */
  clear(): Promise<void>
}

/**
 * Storage adapter interface
 * Abstracts the underlying storage mechanism (localStorage, API, etc.)
 */
export interface IStorageAdapter {
  /**
   * Get data for a specific key
   */
  get<T>(key: string): Promise<T | null>

  /**
   * Set data for a specific key
   */
  set<T>(key: string, value: T): Promise<void>

  /**
   * Remove data for a specific key
   */
  remove(key: string): Promise<void>

  /**
   * Clear all data
   */
  clear(): Promise<void>

  /**
   * Get all keys
   */
  keys(): Promise<string[]>

  /**
   * Export all data as JSON
   */
  export(): Promise<string>

  /**
   * Import data from JSON
   */
  import(json: string): Promise<void>

  /**
   * Get storage usage in bytes
   */
  getUsage(): Promise<number>
}

/**
 * Entity metadata for multi-user support and conflict resolution
 */
export interface EntityMetadata {
  _lastModified: string // ISO timestamp
  _modifiedBy: string // User ID
  _version: number // Incremental version counter
}

/**
 * Entity with metadata
 */
export type EntityWithMetadata<T> = T & EntityMetadata

/**
 * Storage event for cross-tab synchronization
 */
export interface StorageEvent {
  key: string
  action: 'create' | 'update' | 'delete' | 'clear'
  timestamp: string
  userId: string
}

/**
 * Data store configuration
 */
export interface DataStoreConfig {
  prefix: string // Storage key prefix (e.g., "pousada")
  adapter: IStorageAdapter
  userId?: string // Current user ID for metadata
  enableSync?: boolean // Enable cross-tab sync
  enableCache?: boolean // Enable in-memory cache
}

/**
 * Aggregated data store with all repositories
 * This is the main interface components will use
 */
export interface DataStore {
  // Core entities
  rooms: IDataRepository<Room>
  reservations: IDataRepository<Reservation>
  guests: IDataRepository<GuestProfile>
  expenses: IDataRepository<Expense>
  transactions: IDataRepository<Transaction>
  auditLog: IDataRepository<AuditEntry>
  categories: IDataRepository<ExpenseCategory>
  cashCloses: IDataRepository<CashClose>
  consumptions: IDataRepository<RoomConsumption>
  
  // POS entities
  posProducts: IDataRepository<POSProduct>
  posSales: IDataRepository<POSSale>
  productCategories: IDataRepository<ProductCategory>
  
  // Restaurant entities
  restaurantTables: IDataRepository<RestaurantTable>
  restaurantOrders: IDataRepository<RestaurantOrder>
  
  // Stock entities
  stockItems: IDataRepository<StockItem>
  stockMovements: IDataRepository<StockMovement>
  recipes: IDataRepository<Recipe>
  productions: IDataRepository<Production>
  
  // Employee entities
  employees: IDataRepository<Employee>
  employeeConsumptions: IDataRepository<EmployeeConsumption>
  
  // User management entities
  users: IDataRepository<User>
  userSessions: IDataRepository<UserSession>
  systemSettings: IDataRepository<SystemSettings>
  
  // Financial entities
  suppliers: IDataRepository<Supplier>
  customers: IDataRepository<Customer>
  accountsReceivable: IDataRepository<AccountReceivable>
  bankAccounts: IDataRepository<BankAccount>
  bankTransfers: IDataRepository<BankTransfer>
  costCenters: IDataRepository<CostCenter>
  budgets: IDataRepository<Budget>
  recurringTransactions: IDataRepository<RecurringTransaction>
  
  // Utility methods
  exportAll(): Promise<string>
  importAll(json: string): Promise<void>
  clearAll(): Promise<void>
  getStorageUsage(): Promise<number>
}

/**
 * Query options for pagination and sorting
 */
export interface QueryOptions {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
