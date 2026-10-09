/**
 * Data Repositories Index
 *
 * Factory function to create a complete DataStore with all repositories.
 * This is the main entry point for the data layer.
 */

import type { DataStoreConfig } from "../types"
import { LocalStorageAdapter } from "../storage-adapter"
import { DatabaseApiAdapter } from "../database-api-adapter"
import { getDataConfig } from "../config"

// Import all repositories
import { RoomRepository } from "./room-repository"
import { ReservationRepository } from "./reservation-repository"
import { GuestRepository } from "./guest-repository"
import { ExpenseRepository } from "./expense-repository"
import { TransactionRepository } from "./transaction-repository"
import { AuditRepository } from "./audit-repository"
import { CategoryRepository } from "./category-repository"
import { CashCloseRepository } from "./cash-close-repository"
import { ConsumptionRepository } from "./consumption-repository"
import { POSProductRepository } from "./pos-product-repository"
import { POSSaleRepository } from "./pos-sale-repository"
import { ProductCategoryRepository } from "./product-category-repository"
import { RestaurantTableRepository } from "@/modules/abandoned/restaurant/repositories/restaurant-table-repository"
import { RestaurantOrderRepository } from "@/modules/abandoned/restaurant/repositories/restaurant-order-repository"
import { StockItemRepository } from "./stock-item-repository"
import { StockMovementRepository } from "./stock-movement-repository"
import { RecipeRepository } from "@/modules/abandoned/restaurant/repositories/recipe-repository"
import { ProductionRepository } from "@/modules/abandoned/restaurant/repositories/production-repository"
import { EmployeeRepository } from "@/modules/abandoned/restaurant/repositories/employee-repository"
import { EmployeeConsumptionRepository } from "@/modules/abandoned/restaurant/repositories/employee-consumption-repository"
import { UserRepository } from "./user-repository"
import { UserSessionRepository } from "./user-session-repository"
import { SystemSettingsRepository } from "./system-settings-repository"
import { SupplierRepository } from "./supplier-repository"
import { CustomerRepository } from "./customer-repository"
import { AccountReceivableRepository } from "./account-receivable-repository"
import { BankAccountRepository } from "./bank-account-repository"
import { BankTransferRepository } from "./bank-transfer-repository"
import { CostCenterRepository } from "./cost-center-repository"
import { BudgetRepository } from "./budget-repository"
import { RecurringTransactionRepository } from "./recurring-transaction-repository"

/**
 * Create a complete DataStore with all repositories
 *
 * @example
 * ```typescript
 * const dataStore = createDataStore({
 *   prefix: "pousada",
 *   userId: "user-123"
 * })
 *
 * // Use repositories
 * const rooms = await dataStore.rooms.getAll()
 * await dataStore.rooms.create({ number: "101", ... })
 * ```
 */
export function createDataStore(config?: Partial<DataStoreConfig>) {
  const dataConfig = getDataConfig()
  const adapter = config?.adapter ?? (
    dataConfig.adapter === "database"
      ? new DatabaseApiAdapter()
      : new LocalStorageAdapter(config?.prefix ?? "pousada")
  )
  const userId = config?.userId

  // Create all repositories
  const rooms = new RoomRepository(adapter, userId)
  const reservations = new ReservationRepository(adapter, userId)
  const guests = new GuestRepository(adapter, userId)
  const expenses = new ExpenseRepository(adapter, userId)
  const transactions = new TransactionRepository(adapter, userId)
  const auditLog = new AuditRepository(adapter, userId)
  const categories = new CategoryRepository(adapter, userId)
  const cashCloses = new CashCloseRepository(adapter, userId)
  const consumptions = new ConsumptionRepository(adapter, userId)
  const posProducts = new POSProductRepository(adapter, userId)
  const posSales = new POSSaleRepository(adapter, userId)
  const productCategories = new ProductCategoryRepository(adapter, userId)
  const restaurantTables = new RestaurantTableRepository(adapter, userId)
  const restaurantOrders = new RestaurantOrderRepository(adapter, userId)
  const stockItems = new StockItemRepository(adapter, userId)
  const stockMovements = new StockMovementRepository(adapter, userId)
  const recipes = new RecipeRepository(adapter, userId)
  const productions = new ProductionRepository(adapter, userId)
  const employees = new EmployeeRepository(adapter, userId)
  const employeeConsumptions = new EmployeeConsumptionRepository(adapter, userId)
  const users = new UserRepository(adapter, userId)
  const userSessions = new UserSessionRepository(adapter, userId)
  const systemSettings = new SystemSettingsRepository(adapter, userId)
  const suppliers = new SupplierRepository(adapter, userId)
  const customers = new CustomerRepository(adapter, userId)
  const accountsReceivable = new AccountReceivableRepository(adapter, userId)
  const bankAccounts = new BankAccountRepository(adapter, userId)
  const bankTransfers = new BankTransferRepository(adapter, userId)
  const costCenters = new CostCenterRepository(adapter, userId)
  const budgets = new BudgetRepository(adapter, userId)
  const recurringTransactions = new RecurringTransactionRepository(adapter, userId)

  // Return DataStore interface
  return {
    // Core entities
    rooms,
    reservations,
    guests,
    expenses,
    transactions,
    auditLog,
    categories,
    cashCloses,
    consumptions,

    // POS entities
    posProducts,
    posSales,
    productCategories,

    // Restaurant entities
    restaurantTables,
    restaurantOrders,

    // Stock entities
    stockItems,
    stockMovements,
    recipes,
    productions,

    // Employee entities
    employees,
    employeeConsumptions,

    // User management entities
    users,
    userSessions,
    systemSettings,

    // Financial entities
    suppliers,
    customers,
    accountsReceivable,
    bankAccounts,
    bankTransfers,
    costCenters,
    budgets,
    recurringTransactions,

    // Utility methods
    async exportAll(): Promise<string> {
      return adapter.export()
    },

    async importAll(json: string): Promise<void> {
      return adapter.import(json)
    },

    async clearAll(): Promise<void> {
      await adapter.clear()
    },

    async getStorageUsage(): Promise<number> {
      return adapter.getUsage()
    },
  }
}

// Export all repository classes for advanced usage
export * from "./room-repository"
export * from "./reservation-repository"
export * from "./guest-repository"
export * from "./expense-repository"
export * from "./transaction-repository"
export * from "./audit-repository"
export * from "./category-repository"
export * from "./cash-close-repository"
export * from "./consumption-repository"
export * from "./pos-product-repository"
export * from "./pos-sale-repository"
export * from "./product-category-repository"
export * from "@/modules/abandoned/restaurant/repositories/restaurant-table-repository"
export * from "@/modules/abandoned/restaurant/repositories/restaurant-order-repository"
export * from "./stock-item-repository"
export * from "./stock-movement-repository"
export * from "@/modules/abandoned/restaurant/repositories/recipe-repository"
export * from "@/modules/abandoned/restaurant/repositories/production-repository"
export * from "@/modules/abandoned/restaurant/repositories/employee-repository"
export * from "@/modules/abandoned/restaurant/repositories/employee-consumption-repository"
export * from "./user-repository"
export * from "./user-session-repository"
export * from "./system-settings-repository"
export * from "./supplier-repository"
export * from "./customer-repository"
export * from "./account-receivable-repository"
export * from "./bank-account-repository"
export * from "./bank-transfer-repository"
export * from "./cost-center-repository"
export * from "./budget-repository"
export * from "./recurring-transaction-repository"
export * from "./base-repository"
