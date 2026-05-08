import '@testing-library/jest-dom'
import { expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Reset shared state before each test
let resetSharedState: (() => void) | null = null

beforeEach(() => {
  if (resetSharedState) {
    resetSharedState()
  }
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock useDataStore with complete CRUD operations
vi.mock('../../lib/hooks/useDataStore', async () => {
  const store = await import('../../lib/store')
  
  // Shared state across all mock instances - will be reset before each test
  let sharedState = {
    rooms: [...store.initialRooms],
    reservations: [...store.initialReservations],
    guests: [...store.initialGuests],
    expenses: [...store.initialExpenses],
    transactions: [...store.initialTransactions],
    auditLog: [...store.initialAuditLog],
    categories: [...store.initialCategories],
    cashCloses: [...store.initialCashCloses],
    consumptions: [] as any[],
    posProducts: [...store.initialPOSProducts],
    posSales: [...store.initialPOSSales],
    productCategories: [] as any[],
    restaurantTables: [...store.initialRestaurantTables],
    restaurantOrders: [...store.initialRestaurantOrders],
    stockItems: [...store.initialStockItems],
    stockMovements: [...store.initialStockMovements],
    recipes: [...store.initialRecipes],
    productions: [...store.initialProductions],
    employees: [...store.initialEmployees],
    employeeConsumptions: [...store.initialEmployeeConsumptions],
    users: [...store.initialUsers],
    userSessions: [...store.initialUserSessions],
  }
  
  // Export reset function for beforeEach hook
  resetSharedState = () => {
    // Clear and repopulate arrays instead of reassigning to preserve references
    sharedState.rooms.length = 0
    sharedState.rooms.push(...store.initialRooms)
    sharedState.reservations.length = 0
    sharedState.reservations.push(...store.initialReservations)
    sharedState.guests.length = 0
    sharedState.guests.push(...store.initialGuests)
    sharedState.expenses.length = 0
    sharedState.expenses.push(...store.initialExpenses)
    sharedState.transactions.length = 0
    sharedState.transactions.push(...store.initialTransactions)
    sharedState.auditLog.length = 0
    sharedState.auditLog.push(...store.initialAuditLog)
    sharedState.categories.length = 0
    sharedState.categories.push(...store.initialCategories)
    sharedState.cashCloses.length = 0
    sharedState.cashCloses.push(...store.initialCashCloses)
    sharedState.consumptions.length = 0
    sharedState.posProducts.length = 0
    sharedState.posProducts.push(...store.initialPOSProducts)
    sharedState.posSales.length = 0
    sharedState.posSales.push(...store.initialPOSSales)
    sharedState.productCategories.length = 0
    sharedState.restaurantTables.length = 0
    sharedState.restaurantTables.push(...store.initialRestaurantTables)
    sharedState.restaurantOrders.length = 0
    sharedState.restaurantOrders.push(...store.initialRestaurantOrders)
    sharedState.stockItems.length = 0
    sharedState.stockItems.push(...store.initialStockItems)
    sharedState.stockMovements.length = 0
    sharedState.stockMovements.push(...store.initialStockMovements)
    sharedState.recipes.length = 0
    sharedState.recipes.push(...store.initialRecipes)
    sharedState.productions.length = 0
    sharedState.productions.push(...store.initialProductions)
    sharedState.employees.length = 0
    sharedState.employees.push(...store.initialEmployees)
    sharedState.employeeConsumptions.length = 0
    sharedState.employeeConsumptions.push(...store.initialEmployeeConsumptions)
    sharedState.users.length = 0
    sharedState.users.push(...store.initialUsers)
    sharedState.userSessions.length = 0
    sharedState.userSessions.push(...store.initialUserSessions)
  }
  
  const createMockRepo = (dataKey: keyof typeof sharedState) => {
    return {
      getAll: vi.fn(async () => [...sharedState[dataKey]]),
      create: vi.fn(async (item) => {
        const data = sharedState[dataKey]
        const exists = data.some((existing: any) => 
          (item.id && existing.id === item.id) || 
          (item.cpf && existing.cpf === item.cpf)
        )
        if (!exists) data.push(item)
        return item
      }),
      update: vi.fn(async (id: any, updates: any) => {
        const data = sharedState[dataKey]
        const index = data.findIndex((item: any) => item.id === id)
        if (index !== -1) {
          data[index] = { ...data[index], ...updates }
          return data[index]
        }
      }),
      delete: vi.fn(async (id: any) => {
        const data = sharedState[dataKey]
        const index = data.findIndex((item: any) => item.id === id)
        if (index !== -1) {
          data.splice(index, 1)
          return true
        }
        return false
      }),
      count: vi.fn(async () => sharedState[dataKey].length),
      findByCPF: vi.fn(async (cpf: string) => sharedState[dataKey].find((item: any) => item.cpf === cpf)),
      getById: vi.fn(async (id: any) => sharedState[dataKey].find((item: any) => item.id === id)),
      getByRoomId: vi.fn(async (roomId: number) => sharedState[dataKey].find((item: any) => item.roomId === roomId)),
    }
  }
  
  return {
    useDataStore: () => ({
      dataStore: {
        rooms: createMockRepo('rooms'),
        reservations: {
          ...createMockRepo('reservations'),
          create: vi.fn(async (item) => {
            const data = sharedState.reservations
            // Only check for duplicate id, not cpf (guests can have multiple reservations)
            const exists = data.some((existing: any) => item.id && existing.id === item.id)
            if (!exists) data.push(item)
            return item
          }),
        },
        guests: createMockRepo('guests'),
        expenses: createMockRepo('expenses'),
        transactions: createMockRepo('transactions'),
        auditLog: createMockRepo('auditLog'),
        categories: createMockRepo('categories'),
        cashCloses: createMockRepo('cashCloses'),
        consumptions: {
          ...createMockRepo('consumptions'),
          update: vi.fn(async (roomId: number, updates: any) => {
            const data = sharedState.consumptions
            const index = data.findIndex((item: any) => item.roomId === roomId)
            if (index !== -1) {
              data[index] = { ...data[index], ...updates }
              return data[index]
            }
          }),
          clearByRoomId: vi.fn(async (roomId: number) => {
            const data = sharedState.consumptions
            const index = data.findIndex((item: any) => item.roomId === roomId)
            if (index !== -1) {
              data.splice(index, 1)
              return true
            }
            return false
          }),
        },
        posProducts: createMockRepo('posProducts'),
        posSales: createMockRepo('posSales'),
        productCategories: createMockRepo('productCategories'),
        restaurantTables: createMockRepo('restaurantTables'),
        restaurantOrders: createMockRepo('restaurantOrders'),
        stockItems: createMockRepo('stockItems'),
        stockMovements: createMockRepo('stockMovements'),
        recipes: createMockRepo('recipes'),
        productions: createMockRepo('productions'),
        employees: createMockRepo('employees'),
        employeeConsumptions: createMockRepo('employeeConsumptions'),
        users: createMockRepo('users'),
        userSessions: createMockRepo('userSessions'),
        systemSettings: {
          getAll: vi.fn(async () => [store.initialSystemSettings]),
          create: vi.fn(async () => undefined),
          update: vi.fn(async () => undefined),
          count: vi.fn(async () => 1),
        },
      },
      isLoading: false,
      isHydrated: true,
      isSyncing: false,
      reload: vi.fn(async () => undefined),
      exportData: vi.fn(async () => '{}'),
      importData: vi.fn(async () => undefined),
      clearAllData: vi.fn(async () => undefined),
      getStorageUsage: vi.fn(async () => 0),
    }),
  }
})
