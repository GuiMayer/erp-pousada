"use client"

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react"
import {
  initialRooms, initialReservations, initialGuests,
  initialExpenses, initialTransactions, initialAuditLog,
  initialCategories, initialCashCloses,
  initialPOSProducts, initialPOSSales,
  initialRestaurantTables, initialRestaurantOrders,
  initialStockItems, initialStockMovements,
  initialRecipes, initialProductions,
  initialEmployees, initialEmployeeConsumptions,
  type Room, type Reservation, type GuestProfile,
  type Expense, type Transaction, type AuditEntry,
  type ExpenseCategory, type CashClose,
  type RoomConsumption, type ConsumptionItem,
  type POSProduct, type POSSale,
  type RestaurantTable, type RestaurantOrder, type RestaurantOrderItem,
  type StockItem, type StockMovement,
  type Recipe, type Production,
  type Employee, type EmployeeConsumption,
  type ProductCategory,
} from "./store"
import { useDataStore } from "./hooks/useDataStore"
import { useAuth } from "./auth-context"

type AppContextType = {
  rooms: Room[]
  reservations: Reservation[]
  guests: GuestProfile[]
  expenses: Expense[]
  transactions: Transaction[]
  auditLog: AuditEntry[]
  categories: ExpenseCategory[]
  cashCloses: CashClose[]
  consumptions: RoomConsumption[]
  discountCeiling: number
  posProducts: POSProduct[]
  posSales: POSSale[]
  productCategories: ProductCategory[]
  restaurantTables: RestaurantTable[]
  restaurantOrders: RestaurantOrder[]
  stockItems: StockItem[]
  stockMovements: StockMovement[]
  recipes: Recipe[]
  productions: Production[]
  employees: Employee[]
  employeeConsumptions: EmployeeConsumption[]
  isLoading: boolean
  isHydrated: boolean
  updateRoom: (id: number, data: Partial<Room>) => Promise<void>
  addRoom: (room: Room) => Promise<void>
  removeRoom: (id: number) => Promise<void>
  addReservation: (r: Reservation) => Promise<void>
  updateReservation: (id: string, data: Partial<Reservation>) => Promise<void>
  addExpense: (e: Expense) => Promise<void>
  updateExpense: (id: string, data: Partial<Expense>) => Promise<void>
  addTransaction: (t: Transaction) => Promise<void>
  addAuditEntry: (entry: Omit<AuditEntry, "id" | "date">) => Promise<void>
  addCategory: (label: string) => Promise<void>
  addCashClose: (c: CashClose) => Promise<void>
  findGuest: (cpf: string) => GuestProfile | undefined
  addGuest: (g: GuestProfile) => Promise<void>
  setDiscountCeiling: (v: number) => void
  addConsumptionItem: (roomId: number, item: ConsumptionItem) => Promise<void>
  removeConsumptionItem: (roomId: number, itemId: string) => Promise<void>
  getConsumption: (roomId: number) => RoomConsumption | undefined
  clearConsumption: (roomId: number) => Promise<void>
  addPOSProduct: (p: POSProduct) => Promise<void>
  updatePOSProduct: (id: string, data: Partial<POSProduct>) => Promise<void>
  removePOSProduct: (id: string) => Promise<void>
  addPOSSale: (s: POSSale) => Promise<void>
  updatePOSSale: (id: string, data: Partial<POSSale>) => Promise<void>
  addProductCategory: (c: ProductCategory) => Promise<void>
  updateProductCategory: (id: string, data: Partial<ProductCategory>) => Promise<void>
  removeProductCategory: (id: string) => Promise<void>
  addRestaurantTable: (t: RestaurantTable) => Promise<void>
  updateRestaurantTable: (id: number, data: Partial<RestaurantTable>) => Promise<void>
  removeRestaurantTable: (id: number) => Promise<void>
  addRestaurantOrder: (o: RestaurantOrder) => Promise<void>
  updateRestaurantOrder: (id: string, data: Partial<RestaurantOrder>) => Promise<void>
  addOrderItem: (orderId: string, item: RestaurantOrderItem) => Promise<void>
  removeOrderItem: (orderId: string, itemId: string) => Promise<void>
  addStockItem: (s: StockItem) => Promise<void>
  updateStockItem: (id: string, data: Partial<StockItem>) => Promise<void>
  addStockMovement: (m: StockMovement) => Promise<void>
  addRecipe: (r: Recipe) => Promise<void>
  updateRecipe: (id: string, data: Partial<Recipe>) => Promise<void>
  addProduction: (p: Production) => Promise<void>
  addEmployee: (e: Employee) => Promise<void>
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>
  addEmployeeConsumption: (c: EmployeeConsumption) => Promise<void>
  exportData: () => Promise<string>
  importData: (json: string) => Promise<void>
  clearAllData: () => Promise<void>
  getStorageUsage: () => Promise<number>
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  
  // Initialize data store with user context
  const { dataStore, isLoading, isHydrated, isSyncing, exportData, importData, clearAllData, getStorageUsage } = useDataStore({
    userId: user?.username,
    enableSync: true,
    prefix: "pousada"
  })

  // Local state for data (synced with repositories)
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [guests, setGuests] = useState<GuestProfile[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [cashCloses, setCashCloses] = useState<CashClose[]>([])
  const [consumptions, setConsumptions] = useState<RoomConsumption[]>([])
  const [discountCeiling, setDiscountCeiling] = useState(5)
  const [posProducts, setPOSProducts] = useState<POSProduct[]>([])
  const [posSales, setPOSSales] = useState<POSSale[]>([])
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([])
  const [restaurantTables, setRestaurantTables] = useState<RestaurantTable[]>([])
  const [restaurantOrders, setRestaurantOrders] = useState<RestaurantOrder[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [productions, setProductions] = useState<Production[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeConsumptions, setEmployeeConsumptions] = useState<EmployeeConsumption[]>([])

  // Load data from repositories on mount and when syncing
  const loadAllData = useCallback(async () => {
    try {
      const [
        roomsData, reservationsData, guestsData, expensesData, transactionsData,
        auditLogData, categoriesData, cashClosesData, consumptionsData,
        posProductsData, posSalesData, productCategoriesData,
        restaurantTablesData, restaurantOrdersData,
        stockItemsData, stockMovementsData, recipesData, productionsData,
        employeesData, employeeConsumptionsData
      ] = await Promise.all([
        dataStore.rooms.getAll(),
        dataStore.reservations.getAll(),
        dataStore.guests.getAll(),
        dataStore.expenses.getAll(),
        dataStore.transactions.getAll(),
        dataStore.auditLog.getAll(),
        dataStore.categories.getAll(),
        dataStore.cashCloses.getAll(),
        dataStore.consumptions.getAll(),
        dataStore.posProducts.getAll(),
        dataStore.posSales.getAll(),
        dataStore.productCategories.getAll(),
        dataStore.restaurantTables.getAll(),
        dataStore.restaurantOrders.getAll(),
        dataStore.stockItems.getAll(),
        dataStore.stockMovements.getAll(),
        dataStore.recipes.getAll(),
        dataStore.productions.getAll(),
        dataStore.employees.getAll(),
        dataStore.employeeConsumptions.getAll()
      ])

      setRooms(roomsData)
      setReservations(reservationsData)
      setGuests(guestsData)
      setExpenses(expensesData)
      setTransactions(transactionsData)
      setAuditLog(auditLogData)
      setCategories(categoriesData)
      setCashCloses(cashClosesData)
      setConsumptions(consumptionsData)
      setPOSProducts(posProductsData)
      setPOSSales(posSalesData)
      setProductCategories(productCategoriesData)
      setRestaurantTables(restaurantTablesData)
      setRestaurantOrders(restaurantOrdersData)
      setStockItems(stockItemsData)
      setStockMovements(stockMovementsData)
      setRecipes(recipesData)
      setProductions(productionsData)
      setEmployees(employeesData)
      setEmployeeConsumptions(employeeConsumptionsData)
    } catch (error) {
      console.error('[AppContext] Error loading data:', error)
    }
  }, [dataStore])

  // Initial data load and seed if empty
  useEffect(() => {
    const initializeData = async () => {
      // Check if we have any data in storage
      const roomCount = await dataStore.rooms.count()
      
      if (roomCount === 0) {
        // First time - seed with initial data
        console.log('[AppContext] Seeding initial data...')
        await Promise.all([
          ...initialRooms.map(r => dataStore.rooms.create(r)),
          ...initialReservations.map(r => dataStore.reservations.create(r)),
          ...initialGuests.map(g => dataStore.guests.create(g)),
          ...initialExpenses.map(e => dataStore.expenses.create(e)),
          ...initialTransactions.map(t => dataStore.transactions.create(t)),
          ...initialAuditLog.map(a => dataStore.auditLog.create(a)),
          ...initialCategories.map(c => dataStore.categories.create(c)),
          ...initialCashCloses.map(c => dataStore.cashCloses.create(c)),
          ...initialPOSProducts.map(p => dataStore.posProducts.create(p)),
          ...initialPOSSales.map(s => dataStore.posSales.create(s)),
          ...initialRestaurantTables.map(t => dataStore.restaurantTables.create(t)),
          ...initialRestaurantOrders.map(o => dataStore.restaurantOrders.create(o)),
          ...initialStockItems.map(s => dataStore.stockItems.create(s)),
          ...initialStockMovements.map(m => dataStore.stockMovements.create(m)),
          ...initialRecipes.map(r => dataStore.recipes.create(r)),
          ...initialProductions.map(p => dataStore.productions.create(p)),
          ...initialEmployees.map(e => dataStore.employees.create(e)),
          ...initialEmployeeConsumptions.map(c => dataStore.employeeConsumptions.create(c))
        ])
      }
      
      // Load all data into state
      await loadAllData()
    }

    initializeData()
  }, [dataStore, loadAllData])

  // Reload data when syncing from another tab
  useEffect(() => {
    if (isSyncing) {
      loadAllData()
    }
  }, [isSyncing, loadAllData])

  // Room methods
  const updateRoom = useCallback(async (id: number, data: Partial<Room>) => {
    await dataStore.rooms.update(id, data)
    setRooms(await dataStore.rooms.getAll())
  }, [dataStore])

  const addRoom = useCallback(async (room: Room) => {
    await dataStore.rooms.create(room)
    setRooms(await dataStore.rooms.getAll())
  }, [dataStore])

  const removeRoom = useCallback(async (id: number) => {
    await dataStore.rooms.delete(id)
    setRooms(await dataStore.rooms.getAll())
  }, [dataStore])

  // Reservation methods
  const addReservation = useCallback(async (r: Reservation) => {
    await dataStore.reservations.create(r)
    setReservations(await dataStore.reservations.getAll())
  }, [dataStore])

  const updateReservation = useCallback(async (id: string, data: Partial<Reservation>) => {
    await dataStore.reservations.update(id, data)
    setReservations(await dataStore.reservations.getAll())
  }, [dataStore])

  // Expense methods
  const addExpense = useCallback(async (e: Expense) => {
    await dataStore.expenses.create(e)
    setExpenses(await dataStore.expenses.getAll())
  }, [dataStore])

  const updateExpense = useCallback(async (id: string, data: Partial<Expense>) => {
    await dataStore.expenses.update(id, data)
    setExpenses(await dataStore.expenses.getAll())
  }, [dataStore])

  // Transaction methods
  const addTransaction = useCallback(async (t: Transaction) => {
    await dataStore.transactions.create(t)
    setTransactions(await dataStore.transactions.getAll())
  }, [dataStore])

  // Audit methods
  const addAuditEntry = useCallback(async (entry: Omit<AuditEntry, "id" | "date">) => {
    const newEntry: AuditEntry = {
      ...entry,
      id: "", // Will be generated by repository
      date: new Date().toISOString(),
    }
    await dataStore.auditLog.create(newEntry)
    setAuditLog(await dataStore.auditLog.getAll())
  }, [dataStore])

  // Category methods
  const addCategory = useCallback(async (label: string) => {
    await dataStore.categories.create({ id: "", label })
    setCategories(await dataStore.categories.getAll())
  }, [dataStore])

  // Cash close methods
  const addCashClose = useCallback(async (c: CashClose) => {
    await dataStore.cashCloses.create(c)
    setCashCloses(await dataStore.cashCloses.getAll())
  }, [dataStore])

  // Guest methods
  const findGuest = useCallback((cpf: string) => {
    return guests.find(g => g.cpf === cpf)
  }, [guests])

  const addGuest = useCallback(async (g: GuestProfile) => {
    const existing = await dataStore.guests.findByCPF(g.cpf)
    if (!existing) {
      await dataStore.guests.create(g)
      setGuests(await dataStore.guests.getAll())
    }
  }, [dataStore])

  // Consumption methods
  const addConsumptionItem = useCallback(async (roomId: number, item: ConsumptionItem) => {
    const existing = await dataStore.consumptions.getByRoomId(roomId)
    if (existing) {
      await dataStore.consumptions.update(existing.roomId, {
        items: [...existing.items, item]
      })
    } else {
      await dataStore.consumptions.create({ roomId, items: [item] })
    }
    setConsumptions(await dataStore.consumptions.getAll())
  }, [dataStore])

  const removeConsumptionItem = useCallback(async (roomId: number, itemId: string) => {
    const existing = await dataStore.consumptions.getByRoomId(roomId)
    if (existing) {
      await dataStore.consumptions.update(roomId, {
        items: existing.items.filter(i => i.id !== itemId)
      })
      setConsumptions(await dataStore.consumptions.getAll())
    }
  }, [dataStore])

  const getConsumption = useCallback((roomId: number) => {
    return consumptions.find(c => c.roomId === roomId)
  }, [consumptions])

  const clearConsumption = useCallback(async (roomId: number) => {
    await dataStore.consumptions.clearByRoomId(roomId)
    setConsumptions(await dataStore.consumptions.getAll())
  }, [dataStore])

  // POS Product methods
  const addPOSProduct = useCallback(async (p: POSProduct) => {
    await dataStore.posProducts.create(p)
    setPOSProducts(await dataStore.posProducts.getAll())
  }, [dataStore])

  const updatePOSProduct = useCallback(async (id: string, data: Partial<POSProduct>) => {
    await dataStore.posProducts.update(id, data)
    setPOSProducts(await dataStore.posProducts.getAll())
  }, [dataStore])

  const removePOSProduct = useCallback(async (id: string) => {
    await dataStore.posProducts.delete(id)
    setPOSProducts(await dataStore.posProducts.getAll())
  }, [dataStore])

  // POS Sale methods
  const addPOSSale = useCallback(async (s: POSSale) => {
    await dataStore.posSales.create(s)
    setPOSSales(await dataStore.posSales.getAll())
  }, [dataStore])

  const updatePOSSale = useCallback(async (id: string, data: Partial<POSSale>) => {
    await dataStore.posSales.update(id, data)
    setPOSSales(await dataStore.posSales.getAll())
  }, [dataStore])

  // Product Category methods
  const addProductCategory = useCallback(async (c: ProductCategory) => {
    await dataStore.productCategories.create(c)
    setProductCategories(await dataStore.productCategories.getAll())
  }, [dataStore])

  const updateProductCategory = useCallback(async (id: string, data: Partial<ProductCategory>) => {
    await dataStore.productCategories.update(id, data)
    setProductCategories(await dataStore.productCategories.getAll())
  }, [dataStore])

  const removeProductCategory = useCallback(async (id: string) => {
    await dataStore.productCategories.delete(id)
    setProductCategories(await dataStore.productCategories.getAll())
  }, [dataStore])

  // Restaurant Table methods
  const addRestaurantTable = useCallback(async (t: RestaurantTable) => {
    await dataStore.restaurantTables.create(t)
    setRestaurantTables(await dataStore.restaurantTables.getAll())
  }, [dataStore])

  const updateRestaurantTable = useCallback(async (id: number, data: Partial<RestaurantTable>) => {
    await dataStore.restaurantTables.update(id, data)
    setRestaurantTables(await dataStore.restaurantTables.getAll())
  }, [dataStore])

  const removeRestaurantTable = useCallback(async (id: number) => {
    await dataStore.restaurantTables.delete(id)
    setRestaurantTables(await dataStore.restaurantTables.getAll())
  }, [dataStore])

  // Restaurant Order methods
  const addRestaurantOrder = useCallback(async (o: RestaurantOrder) => {
    await dataStore.restaurantOrders.create(o)
    setRestaurantOrders(await dataStore.restaurantOrders.getAll())
  }, [dataStore])

  const updateRestaurantOrder = useCallback(async (id: string, data: Partial<RestaurantOrder>) => {
    await dataStore.restaurantOrders.update(id, data)
    setRestaurantOrders(await dataStore.restaurantOrders.getAll())
  }, [dataStore])

  const addOrderItem = useCallback(async (orderId: string, item: RestaurantOrderItem) => {
    const order = await dataStore.restaurantOrders.getById(orderId)
    if (order) {
      await dataStore.restaurantOrders.update(orderId, {
        items: [...order.items, item]
      })
      setRestaurantOrders(await dataStore.restaurantOrders.getAll())
    }
  }, [dataStore])

  const removeOrderItem = useCallback(async (orderId: string, itemId: string) => {
    const order = await dataStore.restaurantOrders.getById(orderId)
    if (order) {
      await dataStore.restaurantOrders.update(orderId, {
        items: order.items.filter(i => i.id !== itemId)
      })
      setRestaurantOrders(await dataStore.restaurantOrders.getAll())
    }
  }, [dataStore])

  // Stock methods
  const addStockItem = useCallback(async (s: StockItem) => {
    await dataStore.stockItems.create(s)
    setStockItems(await dataStore.stockItems.getAll())
  }, [dataStore])

  const updateStockItem = useCallback(async (id: string, data: Partial<StockItem>) => {
    await dataStore.stockItems.update(id, data)
    setStockItems(await dataStore.stockItems.getAll())
  }, [dataStore])

  const addStockMovement = useCallback(async (m: StockMovement) => {
    await dataStore.stockMovements.create(m)
    setStockMovements(await dataStore.stockMovements.getAll())
  }, [dataStore])

  // Recipe methods
  const addRecipe = useCallback(async (r: Recipe) => {
    await dataStore.recipes.create(r)
    setRecipes(await dataStore.recipes.getAll())
  }, [dataStore])

  const updateRecipe = useCallback(async (id: string, data: Partial<Recipe>) => {
    await dataStore.recipes.update(id, data)
    setRecipes(await dataStore.recipes.getAll())
  }, [dataStore])

  // Production methods
  const addProduction = useCallback(async (p: Production) => {
    await dataStore.productions.create(p)
    setProductions(await dataStore.productions.getAll())
  }, [dataStore])

  // Employee methods
  const addEmployee = useCallback(async (e: Employee) => {
    await dataStore.employees.create(e)
    setEmployees(await dataStore.employees.getAll())
  }, [dataStore])

  const updateEmployee = useCallback(async (id: string, data: Partial<Employee>) => {
    await dataStore.employees.update(id, data)
    setEmployees(await dataStore.employees.getAll())
  }, [dataStore])

  // Employee Consumption methods
  const addEmployeeConsumption = useCallback(async (c: EmployeeConsumption) => {
    await dataStore.employeeConsumptions.create(c)
    setEmployeeConsumptions(await dataStore.employeeConsumptions.getAll())
  }, [dataStore])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    rooms, reservations, guests, expenses, transactions,
    auditLog, categories, cashCloses, consumptions, discountCeiling,
    posProducts, posSales,
    productCategories, restaurantTables, restaurantOrders,
    stockItems, stockMovements, recipes, productions,
    employees, employeeConsumptions,
    isLoading, isHydrated,
    updateRoom, addRoom, removeRoom,
    addReservation, updateReservation,
    addExpense, updateExpense, addTransaction, addAuditEntry,
    addCategory, addCashClose, findGuest, addGuest, setDiscountCeiling,
    addConsumptionItem, removeConsumptionItem, getConsumption, clearConsumption,
    addPOSProduct, updatePOSProduct, removePOSProduct, addPOSSale, updatePOSSale,
    addProductCategory, updateProductCategory, removeProductCategory,
    addRestaurantTable, updateRestaurantTable, removeRestaurantTable,
    addRestaurantOrder, updateRestaurantOrder, addOrderItem, removeOrderItem,
    addStockItem, updateStockItem, addStockMovement,
    addRecipe, updateRecipe, addProduction,
    addEmployee, updateEmployee, addEmployeeConsumption,
    exportData, importData, clearAllData, getStorageUsage,
  }), [
    rooms, reservations, guests, expenses, transactions,
    auditLog, categories, cashCloses, consumptions, discountCeiling,
    posProducts, posSales,
    productCategories, restaurantTables, restaurantOrders,
    stockItems, stockMovements, recipes, productions,
    employees, employeeConsumptions,
    isLoading, isHydrated,
    updateRoom, addRoom, removeRoom,
    addReservation, updateReservation,
    addExpense, updateExpense, addTransaction, addAuditEntry,
    addCategory, addCashClose, findGuest, addGuest,
    addConsumptionItem, removeConsumptionItem, getConsumption, clearConsumption,
    addPOSProduct, updatePOSProduct, removePOSProduct, addPOSSale, updatePOSSale,
    addProductCategory, updateProductCategory, removeProductCategory,
    addRestaurantTable, updateRestaurantTable, removeRestaurantTable,
    addRestaurantOrder, updateRestaurantOrder, addOrderItem, removeOrderItem,
    addStockItem, updateStockItem, addStockMovement,
    addRecipe, updateRecipe, addProduction,
    addEmployee, updateEmployee, addEmployeeConsumption,
    exportData, importData, clearAllData, getStorageUsage,
  ])

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
