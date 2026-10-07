"use client"

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react"
import {
  initialRooms, initialReservations, initialGuests,
  initialExpenses, initialTransactions, initialAuditLog,
  initialCategories, initialCashCloses,
  initialPOSProducts, initialPOSSales, initialProductCategories,
  initialRestaurantTables, initialRestaurantOrders,
  initialStockItems, initialStockMovements,
  initialRecipes, initialProductions,
  initialEmployees, initialEmployeeConsumptions,
  initialBankAccounts, initialBankTransfers, initialCostCenters, initialBudgets, initialRecurringTransactions,
  initialUsers, initialUserSessions, initialSystemSettings,
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
  type User, type UserSession, type SystemSettings,
  type Supplier, type Customer, type AccountReceivable,
  type BankAccount, type BankTransfer, type CostCenter, type Budget, type RecurringTransaction,
  type TimelineDay,
  calculateRoomTimeline,
} from "./store"
import { useDataStore } from "./hooks/useDataStore"
import { useAuth } from "./auth-context"
import { getDataConfig } from "./data/config"
import { seedDemoIfEmpty } from "./demo-data"

const RESERVATION_BLOCKING_STATUSES = new Set<Reservation["status"]>(["confirmada", "checkin"])

function assertReservationAvailability(
  nextReservation: Reservation,
  currentReservations: Reservation[],
  ignoreReservationId?: string
) {
  if (!RESERVATION_BLOCKING_STATUSES.has(nextReservation.status)) {
    return
  }

  const nextCheckIn = new Date(`${nextReservation.checkIn}T00:00:00`)
  const nextCheckOut = new Date(`${nextReservation.checkOut}T00:00:00`)

  if (nextCheckOut <= nextCheckIn) {
    throw new Error("Check-out must be after check-in")
  }

  const conflicting = currentReservations.find((reservation) => {
    if (reservation.id === ignoreReservationId) return false
    if (reservation.roomId !== nextReservation.roomId) return false
    if (!RESERVATION_BLOCKING_STATUSES.has(reservation.status)) return false

    const checkIn = new Date(`${reservation.checkIn}T00:00:00`)
    const checkOut = new Date(`${reservation.checkOut}T00:00:00`)

    return nextCheckIn < checkOut && nextCheckOut > checkIn
  })

  if (conflicting) {
    throw new Error(`Quarto ${nextReservation.roomNumber} ja possui reserva ativa no periodo selecionado`)
  }
}

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
  users: User[]
  userSessions: UserSession[]
  systemSettings: SystemSettings
  suppliers: Supplier[]
  customers: Customer[]
  accountsReceivable: AccountReceivable[]
  bankAccounts: BankAccount[]
  bankTransfers: BankTransfer[]
  costCenters: CostCenter[]
  budgets: Budget[]
  recurringTransactions: RecurringTransaction[]
  isLoading: boolean
  isHydrated: boolean
  updateRoom: (id: number, data: Partial<Room>) => Promise<void>
  addRoom: (room: Room) => Promise<void>
  removeRoom: (id: number) => Promise<void>
  getRoomTimeline: (roomId: number, startDate: string, days?: number) => TimelineDay[]
  addReservation: (r: Reservation) => Promise<void>
  updateReservation: (id: string, data: Partial<Reservation>) => Promise<void>
  addExpense: (e: Expense) => Promise<void>
  updateExpense: (id: string, data: Partial<Expense>) => Promise<void>
  markInstallmentAsPaid: (expenseId: string, installmentId: string) => Promise<void>
  addTransaction: (t: Transaction) => Promise<void>
  addAuditEntry: (entry: Omit<AuditEntry, "id" | "date">) => Promise<void>
  addCategory: (label: string) => Promise<void>
  addCashClose: (c: CashClose) => Promise<void>
  findGuest: (cpf: string) => GuestProfile | undefined
  addGuest: (g: GuestProfile) => Promise<void>
  updateGuest: (cpf: string, data: Partial<GuestProfile>) => Promise<void>
  removeGuest: (cpf: string) => Promise<void>
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
  getCategoryName: (categoryId: string) => string
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
  updateProduction: (id: string, data: Partial<Production>) => Promise<void>
  removeProduction: (id: string) => Promise<void>
  addEmployee: (e: Employee) => Promise<void>
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>
  addEmployeeConsumption: (c: EmployeeConsumption) => Promise<void>
  updateEmployeeConsumption: (id: string, data: Partial<EmployeeConsumption>) => Promise<void>
  removeEmployeeConsumption: (id: string) => Promise<void>
  addUser: (u: User) => Promise<void>
  updateUser: (id: string, data: Partial<User>) => Promise<void>
  findUser: (username: string) => User | undefined
  addUserSession: (s: UserSession) => Promise<void>
  updateSystemSettings: (data: Partial<SystemSettings>) => Promise<void>
  addSupplier: (s: Supplier) => Promise<void>
  updateSupplier: (id: string, data: Partial<Supplier>) => Promise<void>
  removeSupplier: (id: string) => Promise<void>
  addCustomer: (c: Customer) => Promise<void>
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>
  removeCustomer: (id: string) => Promise<void>
  addAccountReceivable: (ar: AccountReceivable) => Promise<void>
  updateAccountReceivable: (id: string, data: Partial<AccountReceivable>) => Promise<void>
  removeAccountReceivable: (id: string) => Promise<void>
  addBankAccount: (account: BankAccount) => Promise<void>
  updateBankAccount: (id: string, data: Partial<BankAccount>) => Promise<void>
  removeBankAccount: (id: string) => Promise<void>
  addBankTransfer: (transfer: BankTransfer) => Promise<void>
  updateBankTransfer: (id: string, data: Partial<BankTransfer>) => Promise<void>
  removeBankTransfer: (id: string) => Promise<void>
  addCostCenter: (costCenter: CostCenter) => Promise<void>
  updateCostCenter: (id: string, data: Partial<CostCenter>) => Promise<void>
  removeCostCenter: (id: string) => Promise<void>
  addBudget: (budget: Budget) => Promise<void>
  updateBudget: (id: string, data: Partial<Budget>) => Promise<void>
  removeBudget: (id: string) => Promise<void>
  addRecurringTransaction: (transaction: RecurringTransaction) => Promise<void>
  updateRecurringTransaction: (id: string, data: Partial<RecurringTransaction>) => Promise<void>
  removeRecurringTransaction: (id: string) => Promise<void>
  exportData: () => Promise<string>
  importData: (json: string) => Promise<void>
  clearAllData: () => Promise<void>
  getStorageUsage: () => Promise<number>
}

const AppContext = createContext<AppContextType | null>(null)

// Export for testing
export { AppContext }

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  
  // Initialize data store with user context
  const { dataStore, isLoading, isHydrated, isSyncing, exportData, importData, clearAllData, getStorageUsage } = useDataStore({
    userId: user?.username,
    enableSync: true,
    prefix: getDataConfig().adapter === "demo-localStorage" ? "erp-pousada-demo" : "pousada"
  })

  // Local state for data (synced with repositories)
  const [isInitialized, setIsInitialized] = useState(false)
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
  const [users, setUsers] = useState<User[]>([])
  const [userSessions, setUserSessions] = useState<UserSession[]>([])
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(initialSystemSettings)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [accountsReceivable, setAccountsReceivable] = useState<AccountReceivable[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankTransfers, setBankTransfers] = useState<BankTransfer[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([])

  // Load data from repositories on mount and when syncing
  const loadAllData = useCallback(async () => {
    try {
      const [
        roomsData, reservationsData, guestsData, expensesData, transactionsData,
        auditLogData, categoriesData, cashClosesData, consumptionsData,
        posProductsData, posSalesData, productCategoriesData,
        restaurantTablesData, restaurantOrdersData,
        stockItemsData, stockMovementsData, recipesData, productionsData,
        employeesData, employeeConsumptionsData,
        usersData, userSessionsData, systemSettingsData,
        suppliersData, customersData, accountsReceivableData,
        bankAccountsData, bankTransfersData, costCentersData, budgetsData, recurringTransactionsData
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
        dataStore.employeeConsumptions.getAll(),
        dataStore.users.getAll(),
        dataStore.userSessions.getAll(),
        dataStore.systemSettings.getAll(),
        dataStore.suppliers.getAll(),
        dataStore.customers.getAll(),
        dataStore.accountsReceivable.getAll(),
        dataStore.bankAccounts.getAll(),
        dataStore.bankTransfers.getAll(),
        dataStore.costCenters.getAll(),
        dataStore.budgets.getAll(),
        dataStore.recurringTransactions.getAll()
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
      setUsers(usersData)
      setUserSessions(userSessionsData)
      setSystemSettings(systemSettingsData[0] || initialSystemSettings)
      setSuppliers(suppliersData)
      setCustomers(customersData)
      setAccountsReceivable(accountsReceivableData)
      setBankAccounts(bankAccountsData)
      setBankTransfers(bankTransfersData)
      setCostCenters(costCentersData)
      setBudgets(budgetsData)
      setRecurringTransactions(recurringTransactionsData)
    } catch (error) {
      console.error('[AppContext] Error loading data:', error)
    }
  }, [dataStore])

  // Initial data load and seed if empty
  useEffect(() => {
    if (isInitialized) return // Guard: prevent re-initialization
    
    const initializeData = async () => {
      // Check if we have any data in storage
      const roomCount = await dataStore.rooms.count()
      
      if (getDataConfig().adapter === "demo-localStorage") {
        await seedDemoIfEmpty(dataStore)
      } else if (roomCount === 0) {
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
          ...initialProductCategories.map(c => dataStore.productCategories.create(c)),
          ...initialPOSProducts.map(p => dataStore.posProducts.create(p)),
          ...initialPOSSales.map(s => dataStore.posSales.create(s)),
          ...initialRestaurantTables.map(t => dataStore.restaurantTables.create(t)),
          ...initialRestaurantOrders.map(o => dataStore.restaurantOrders.create(o)),
          ...initialStockItems.map(s => dataStore.stockItems.create(s)),
          ...initialStockMovements.map(m => dataStore.stockMovements.create(m)),
          ...initialRecipes.map(r => dataStore.recipes.create(r)),
          ...initialProductions.map(p => dataStore.productions.create(p)),
          ...initialEmployees.map(e => dataStore.employees.create(e)),
          ...initialEmployeeConsumptions.map(c => dataStore.employeeConsumptions.create(c)),
          ...initialBankAccounts.map(account => dataStore.bankAccounts.create(account)),
          ...initialBankTransfers.map(transfer => dataStore.bankTransfers.create(transfer)),
          ...initialCostCenters.map(costCenter => dataStore.costCenters.create(costCenter)),
          ...initialBudgets.map(budget => dataStore.budgets.create(budget)),
          ...initialRecurringTransactions.map(transaction => dataStore.recurringTransactions.create(transaction)),
          dataStore.systemSettings.create(initialSystemSettings)
        ])
      }
      
      // Ensure system settings exist (for existing installations)
      const settingsCount = await dataStore.systemSettings.count()
      if (settingsCount === 0) {
        console.log('[AppContext] Initializing system settings...')
        await dataStore.systemSettings.create(initialSystemSettings)
      }
      
      // Load all data into state
      await loadAllData()
      
      // Mark as initialized
      setIsInitialized(true)
    }

    initializeData()
  }, [dataStore, isInitialized, loadAllData])

  // Reload data when syncing from another tab
  useEffect(() => {
    if (isSyncing) {
      loadAllData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing])

  // Audit methods - MUST be defined before other callbacks that use it
  const addAuditEntry = useCallback(async (entry: Omit<AuditEntry, "id" | "date">) => {
    const newEntry: AuditEntry = {
      ...entry,
      id: "", // Will be generated by repository
      date: new Date().toISOString(),
    }
    await dataStore.auditLog.create(newEntry)
    setAuditLog(await dataStore.auditLog.getAll())
  }, [dataStore])

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

  const getRoomTimeline = useCallback((roomId: number, startDate: string, days: number = 7): TimelineDay[] => {
    const room = rooms.find(r => r.id === roomId)
    if (!room) {
      return []
    }
    return calculateRoomTimeline(room, reservations, startDate, days)
  }, [rooms, reservations])

  // Reservation methods
  const addReservation = useCallback(async (r: Reservation) => {
    const currentReservations = await dataStore.reservations.getAll()
    assertReservationAvailability(r, currentReservations)

    const created = await dataStore.reservations.create(r)
    setReservations(await dataStore.reservations.getAll())
    
    // Audit trail
    await addAuditEntry({
      user: user?.username || "sistema",
      action: `Reserva criada: ${r.guestName}`,
      reference: `Reserva #${created.id}`,
      entityType: 'Reservation',
      entityId: created.id,
      operation: 'create',
      metadata: {
        after: {
          guestName: r.guestName,
          cpf: r.cpf,
          roomNumber: r.roomNumber,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          status: r.status,
          totalValue: r.totalValue
        }
      }
    })
  }, [dataStore, user?.username, addAuditEntry])

  const updateReservation = useCallback(async (id: string, data: Partial<Reservation>) => {
    const before = await dataStore.reservations.getById(id)
    if (!before) return

    const currentReservations = await dataStore.reservations.getAll()
    const nextReservation = { ...before, ...data }
    assertReservationAvailability(nextReservation, currentReservations, id)

    await dataStore.reservations.update(id, data)
    const after = await dataStore.reservations.getById(id)
    setReservations(await dataStore.reservations.getAll())
    
    // Audit trail
    if (before && after) {
      await addAuditEntry({
        user: user?.username || "sistema",
        action: `Reserva atualizada: ${after.guestName}`,
        reference: `Reserva #${id}`,
        entityType: 'Reservation',
        entityId: id,
        operation: 'update',
        metadata: {
          before: {
            status: before.status,
            checkIn: before.checkIn,
            checkOut: before.checkOut,
            totalValue: before.totalValue
          },
          after: {
            status: after.status,
            checkIn: after.checkIn,
            checkOut: after.checkOut,
            totalValue: after.totalValue
          }
        }
      })
    }
  }, [dataStore, user?.username, addAuditEntry])

  // Expense methods
  const addExpense = useCallback(async (e: Expense) => {
    const created = await dataStore.expenses.create(e)
    setExpenses(await dataStore.expenses.getAll())
    
    // Audit trail
    await addAuditEntry({
      user: user?.username || "sistema",
      action: `Despesa criada: ${e.description}`,
      reference: `Despesa #${created.id}`,
      entityType: 'Expense',
      entityId: created.id,
      operation: 'create',
      metadata: {
        after: {
          category: e.category,
          value: e.value,
          dueDate: e.dueDate,
          paid: e.paid
        }
      }
    })
  }, [dataStore, user?.username, addAuditEntry])

  const updateExpense = useCallback(async (id: string, data: Partial<Expense>) => {
    const before = await dataStore.expenses.getById(id)
    await dataStore.expenses.update(id, data)
    const after = await dataStore.expenses.getById(id)
    setExpenses(await dataStore.expenses.getAll())
    
    // Audit trail
    if (before && after) {
      await addAuditEntry({
        user: user?.username || "sistema",
        action: `Despesa atualizada: ${after.description}`,
        reference: `Despesa #${id}`,
        entityType: 'Expense',
        entityId: id,
        operation: 'update',
        metadata: {
          before: {
            category: before.category,
            value: before.value,
            paid: before.paid
          },
          after: {
            category: after.category,
            value: after.value,
            paid: after.paid
          }
        }
      })
    }
  }, [dataStore, user?.username, addAuditEntry])

  const markInstallmentAsPaid = useCallback(async (expenseId: string, installmentId: string) => {
    const expense = await dataStore.expenses.getById(expenseId)
    if (!expense) return

    await dataStore.expenses.markInstallmentAsPaid(expenseId, installmentId)
    setExpenses(await dataStore.expenses.getAll())
    
    // Audit trail
    const installment = expense.installments?.find(i => i.id === installmentId)
    if (installment) {
      await addAuditEntry({
        user: user?.username || "sistema",
        action: `Parcela ${installment.installmentNumber} paga: ${expense.description}`,
        reference: `Despesa #${expenseId}`,
        entityType: 'Expense',
        entityId: expenseId,
        operation: 'update',
        metadata: {
          installmentId,
          installmentNumber: installment.installmentNumber,
          value: installment.value
        }
      })
    }
  }, [dataStore, user?.username, addAuditEntry])

  // Transaction methods
  const addTransaction = useCallback(async (t: Transaction) => {
    const created = await dataStore.transactions.create(t)
    setTransactions(await dataStore.transactions.getAll())
    
    // Audit trail
    await addAuditEntry({
      user: user?.username || "sistema",
      action: `Transação criada: ${t.description}`,
      reference: `Transação #${created.id}`,
      entityType: 'Transaction',
      entityId: created.id,
      operation: 'create',
      metadata: {
        after: {
          value: t.value,
          type: t.type,
          category: t.category,
          paymentMethod: t.paymentMethod
        }
      }
    })
  }, [dataStore, user?.username, addAuditEntry])

  // Category methods
  const addCategory = useCallback(async (label: string) => {
    const created = await dataStore.categories.create({ id: "", label })
    setCategories(await dataStore.categories.getAll())
    
    // Audit trail
    await addAuditEntry({
      user: user?.username || "sistema",
      action: `Categoria criada: ${label}`,
      reference: `Categoria #${created.id}`,
      entityType: 'ExpenseCategory',
      entityId: created.id,
      operation: 'create',
      metadata: {
        after: {
          label: label
        }
      }
    })
  }, [dataStore, user?.username, addAuditEntry])

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
      const created = await dataStore.guests.create(g)
      setGuests(await dataStore.guests.getAll())
      
      // Audit trail
      await addAuditEntry({
        user: user?.username || "sistema",
        action: `Hóspede cadastrado: ${g.name}`,
        reference: `CPF ${g.cpf}`,
        entityType: 'GuestProfile',
        entityId: g.cpf,
        operation: 'create',
        metadata: {
          after: {
            name: g.name,
            cpf: g.cpf,
            totalStays: g.totalStays,
            avgTicket: g.avgTicket
          }
        }
      })
    }
  }, [dataStore, user?.username, addAuditEntry])

  const updateGuest = useCallback(async (cpf: string, data: Partial<GuestProfile>) => {
    await dataStore.guests.update(cpf, data)
    setGuests(await dataStore.guests.getAll())
  }, [dataStore])

  const removeGuest = useCallback(async (cpf: string) => {
    await dataStore.guests.delete(cpf)
    setGuests(await dataStore.guests.getAll())
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

  const getCategoryName = useCallback((categoryId: string): string => {
    const category = productCategories.find(c => c.id === categoryId)
    return category?.name || categoryId
  }, [productCategories])

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
    const created = await dataStore.stockItems.create(s)
    setStockItems(await dataStore.stockItems.getAll())
    
    // Audit trail
    await addAuditEntry({
      user: user?.username || "sistema",
      action: `Item de estoque criado: ${s.productName}`,
      reference: `Item #${created.id}`,
      entityType: 'StockItem',
      entityId: created.id,
      operation: 'create',
      metadata: {
        after: {
          productName: s.productName,
          currentStock: s.currentStock,
          unit: s.unit,
          minimumStock: s.minimumStock
        }
      }
    })
  }, [dataStore, user?.username, addAuditEntry])

  const updateStockItem = useCallback(async (id: string, data: Partial<StockItem>) => {
    const before = await dataStore.stockItems.getById(id)
    await dataStore.stockItems.update(id, data)
    const after = await dataStore.stockItems.getById(id)
    setStockItems(await dataStore.stockItems.getAll())
    
    // Audit trail
    if (before && after) {
      await addAuditEntry({
        user: user?.username || "sistema",
        action: `Item de estoque atualizado: ${after.productName}`,
        reference: `Item #${id}`,
        entityType: 'StockItem',
        entityId: id,
        operation: 'update',
        metadata: {
          before: {
            currentStock: before.currentStock,
            minimumStock: before.minimumStock,
            maximumStock: before.maximumStock
          },
          after: {
            currentStock: after.currentStock,
            minimumStock: after.minimumStock,
            maximumStock: after.maximumStock
          }
        }
      })
    }
  }, [dataStore, user?.username, addAuditEntry])

  const addStockMovement = useCallback(async (m: StockMovement) => {
    const created = await dataStore.stockMovements.create(m)
    setStockMovements(await dataStore.stockMovements.getAll())
    
    // Audit trail
    await addAuditEntry({
      user: user?.username || "sistema",
      action: `Movimentação de estoque: ${m.type} - ${m.productName}`,
      reference: `Movimento #${created.id}`,
      entityType: 'StockMovement',
      entityId: created.id,
      operation: 'create',
      metadata: {
        after: {
          type: m.type,
          productName: m.productName,
          quantity: m.quantity,
          unit: m.unit,
          reason: m.reason,
          registeredBy: m.registeredBy
        }
      }
    })
  }, [dataStore, user?.username, addAuditEntry])

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
    const created = await dataStore.productions.create(p)
    setProductions(await dataStore.productions.getAll())
    
    // Audit trail
    await addAuditEntry({
      user: user?.username || "sistema",
      action: `Produção registrada: ${p.recipeName}`,
      reference: `Produção #${created.id}`,
      entityType: 'Production',
      entityId: created.id,
      operation: 'create',
      metadata: {
        after: {
          recipeName: p.recipeName,
          plannedQuantity: p.plannedQuantity,
          producedQuantity: p.producedQuantity,
          yield: p.yield,
          totalCost: p.totalCost,
          producedBy: p.producedBy
        }
      }
    })
  }, [dataStore, user?.username, addAuditEntry])

  const updateProduction = useCallback(async (id: string, data: Partial<Production>) => {
    await dataStore.productions.update(id, data)
    setProductions(await dataStore.productions.getAll())
  }, [dataStore])

  const removeProduction = useCallback(async (id: string) => {
    await dataStore.productions.delete(id)
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

  const updateEmployeeConsumption = useCallback(async (id: string, data: Partial<EmployeeConsumption>) => {
    await dataStore.employeeConsumptions.update(id, data)
    setEmployeeConsumptions(await dataStore.employeeConsumptions.getAll())
  }, [dataStore])

  const removeEmployeeConsumption = useCallback(async (id: string) => {
    await dataStore.employeeConsumptions.delete(id)
    setEmployeeConsumptions(await dataStore.employeeConsumptions.getAll())
  }, [dataStore])

  // User methods
  const addUser = useCallback(async (u: User) => {
    await dataStore.users.create(u)
    setUsers(await dataStore.users.getAll())
  }, [dataStore])

  const updateUser = useCallback(async (id: string, data: Partial<User>) => {
    await dataStore.users.update(id, data)
    setUsers(await dataStore.users.getAll())
  }, [dataStore])

  const findUser = useCallback((username: string) => {
    return users.find(u => u.username === username)
  }, [users])

  // User Session methods
  const addUserSession = useCallback(async (s: UserSession) => {
    await dataStore.userSessions.create(s)
    setUserSessions(await dataStore.userSessions.getAll())
  }, [dataStore])

  // System Settings methods
  const updateSystemSettings = useCallback(async (data: Partial<SystemSettings>) => {
    try {
      // Check if settings exist in database
      const existing = await dataStore.systemSettings.getAll()
      
      if (existing.length > 0) {
        // Update existing settings
        await dataStore.systemSettings.update(existing[0].id, data)
      } else {
        // Create new settings if they don't exist
        await dataStore.systemSettings.create({ ...initialSystemSettings, ...data })
      }
      
      // Reload settings
      const updated = await dataStore.systemSettings.getAll()
      setSystemSettings(updated[0] || initialSystemSettings)
    } catch (error) {
      console.error('[AppContext] Error updating system settings:', error)
      throw error
    }
  }, [dataStore])

  // Supplier methods
  const addSupplier = useCallback(async (s: Supplier) => {
    await dataStore.suppliers.create(s)
    setSuppliers(await dataStore.suppliers.getAll())
  }, [dataStore])

  const updateSupplier = useCallback(async (id: string, data: Partial<Supplier>) => {
    await dataStore.suppliers.update(id, data)
    setSuppliers(await dataStore.suppliers.getAll())
  }, [dataStore])

  const removeSupplier = useCallback(async (id: string) => {
    await dataStore.suppliers.delete(id)
    setSuppliers(await dataStore.suppliers.getAll())
  }, [dataStore])

  // Customer methods
  const addCustomer = useCallback(async (c: Customer) => {
    await dataStore.customers.create(c)
    setCustomers(await dataStore.customers.getAll())
  }, [dataStore])

  const updateCustomer = useCallback(async (id: string, data: Partial<Customer>) => {
    await dataStore.customers.update(id, data)
    setCustomers(await dataStore.customers.getAll())
  }, [dataStore])

  const removeCustomer = useCallback(async (id: string) => {
    await dataStore.customers.delete(id)
    setCustomers(await dataStore.customers.getAll())
  }, [dataStore])

  // Account Receivable methods
  const addAccountReceivable = useCallback(async (ar: AccountReceivable) => {
    await dataStore.accountsReceivable.create(ar)
    setAccountsReceivable(await dataStore.accountsReceivable.getAll())
  }, [dataStore])

  const updateAccountReceivable = useCallback(async (id: string, data: Partial<AccountReceivable>) => {
    await dataStore.accountsReceivable.update(id, data)
    setAccountsReceivable(await dataStore.accountsReceivable.getAll())
  }, [dataStore])

  const removeAccountReceivable = useCallback(async (id: string) => {
    await dataStore.accountsReceivable.delete(id)
    setAccountsReceivable(await dataStore.accountsReceivable.getAll())
  }, [dataStore])

  // Financial cadastro methods
  const addBankAccount = useCallback(async (account: BankAccount) => {
    await dataStore.bankAccounts.create(account)
    setBankAccounts(await dataStore.bankAccounts.getAll())
  }, [dataStore])

  const updateBankAccount = useCallback(async (id: string, data: Partial<BankAccount>) => {
    await dataStore.bankAccounts.update(id, data)
    setBankAccounts(await dataStore.bankAccounts.getAll())
  }, [dataStore])

  const removeBankAccount = useCallback(async (id: string) => {
    await dataStore.bankAccounts.delete(id)
    setBankAccounts(await dataStore.bankAccounts.getAll())
  }, [dataStore])

  const addBankTransfer = useCallback(async (transfer: BankTransfer) => {
    await dataStore.bankTransfers.create(transfer)
    setBankTransfers(await dataStore.bankTransfers.getAll())
  }, [dataStore])

  const updateBankTransfer = useCallback(async (id: string, data: Partial<BankTransfer>) => {
    await dataStore.bankTransfers.update(id, data)
    setBankTransfers(await dataStore.bankTransfers.getAll())
  }, [dataStore])

  const removeBankTransfer = useCallback(async (id: string) => {
    await dataStore.bankTransfers.delete(id)
    setBankTransfers(await dataStore.bankTransfers.getAll())
  }, [dataStore])

  const addCostCenter = useCallback(async (costCenter: CostCenter) => {
    await dataStore.costCenters.create(costCenter)
    setCostCenters(await dataStore.costCenters.getAll())
  }, [dataStore])

  const updateCostCenter = useCallback(async (id: string, data: Partial<CostCenter>) => {
    await dataStore.costCenters.update(id, data)
    setCostCenters(await dataStore.costCenters.getAll())
  }, [dataStore])

  const removeCostCenter = useCallback(async (id: string) => {
    await dataStore.costCenters.delete(id)
    setCostCenters(await dataStore.costCenters.getAll())
  }, [dataStore])

  const addBudget = useCallback(async (budget: Budget) => {
    await dataStore.budgets.create(budget)
    setBudgets(await dataStore.budgets.getAll())
  }, [dataStore])

  const updateBudget = useCallback(async (id: string, data: Partial<Budget>) => {
    await dataStore.budgets.update(id, data)
    setBudgets(await dataStore.budgets.getAll())
  }, [dataStore])

  const removeBudget = useCallback(async (id: string) => {
    await dataStore.budgets.delete(id)
    setBudgets(await dataStore.budgets.getAll())
  }, [dataStore])

  const addRecurringTransaction = useCallback(async (transaction: RecurringTransaction) => {
    await dataStore.recurringTransactions.create(transaction)
    setRecurringTransactions(await dataStore.recurringTransactions.getAll())
  }, [dataStore])

  const updateRecurringTransaction = useCallback(async (id: string, data: Partial<RecurringTransaction>) => {
    await dataStore.recurringTransactions.update(id, data)
    setRecurringTransactions(await dataStore.recurringTransactions.getAll())
  }, [dataStore])

  const removeRecurringTransaction = useCallback(async (id: string) => {
    await dataStore.recurringTransactions.delete(id)
    setRecurringTransactions(await dataStore.recurringTransactions.getAll())
  }, [dataStore])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    rooms, reservations, guests, expenses, transactions,
    auditLog, categories, cashCloses, consumptions, discountCeiling,
    posProducts, posSales,
    productCategories, restaurantTables, restaurantOrders,
    stockItems, stockMovements, recipes, productions,
    employees, employeeConsumptions,
    users, userSessions, systemSettings,
    suppliers, customers, accountsReceivable,
    bankAccounts, bankTransfers, costCenters, budgets, recurringTransactions,
    isLoading, isHydrated,
    updateRoom, addRoom, removeRoom, getRoomTimeline,
    addReservation, updateReservation,
    addExpense, updateExpense, markInstallmentAsPaid, addTransaction, addAuditEntry,
    addCategory, addCashClose, findGuest, addGuest, updateGuest, removeGuest, setDiscountCeiling,
    addConsumptionItem, removeConsumptionItem, getConsumption, clearConsumption,
    addPOSProduct, updatePOSProduct, removePOSProduct, addPOSSale, updatePOSSale,
    addProductCategory, updateProductCategory, removeProductCategory, getCategoryName,
    addRestaurantTable, updateRestaurantTable, removeRestaurantTable,
    addRestaurantOrder, updateRestaurantOrder, addOrderItem, removeOrderItem,
    addStockItem, updateStockItem, addStockMovement,
    addRecipe, updateRecipe, addProduction, updateProduction, removeProduction,
    addEmployee, updateEmployee, addEmployeeConsumption, updateEmployeeConsumption, removeEmployeeConsumption,
    addUser, updateUser, findUser, addUserSession, updateSystemSettings,
    addSupplier, updateSupplier, removeSupplier,
    addCustomer, updateCustomer, removeCustomer,
    addAccountReceivable, updateAccountReceivable, removeAccountReceivable,
    addBankAccount, updateBankAccount, removeBankAccount,
    addBankTransfer, updateBankTransfer, removeBankTransfer,
    addCostCenter, updateCostCenter, removeCostCenter,
    addBudget, updateBudget, removeBudget,
    addRecurringTransaction, updateRecurringTransaction, removeRecurringTransaction,
    exportData, importData, clearAllData, getStorageUsage,
  }), [
    rooms, reservations, guests, expenses, transactions,
    auditLog, categories, cashCloses, consumptions, discountCeiling,
    posProducts, posSales,
    productCategories, restaurantTables, restaurantOrders,
    stockItems, stockMovements, recipes, productions,
    employees, employeeConsumptions,
    users, userSessions, systemSettings,
    suppliers, customers, accountsReceivable,
    bankAccounts, bankTransfers, costCenters, budgets, recurringTransactions,
    isLoading, isHydrated,
    updateRoom, addRoom, removeRoom, getRoomTimeline,
    addReservation, updateReservation,
    addExpense, updateExpense, markInstallmentAsPaid, addTransaction, addAuditEntry,
    addCategory, addCashClose, findGuest, addGuest, updateGuest, removeGuest,
    addConsumptionItem, removeConsumptionItem, getConsumption, clearConsumption,
    addPOSProduct, updatePOSProduct, removePOSProduct, addPOSSale, updatePOSSale,
    addProductCategory, updateProductCategory, removeProductCategory, getCategoryName,
    addRestaurantTable, updateRestaurantTable, removeRestaurantTable,
    addRestaurantOrder, updateRestaurantOrder, addOrderItem, removeOrderItem,
    addStockItem, updateStockItem, addStockMovement,
    addRecipe, updateRecipe, addProduction, updateProduction, removeProduction,
    addEmployee, updateEmployee, addEmployeeConsumption, updateEmployeeConsumption, removeEmployeeConsumption,
    addUser, updateUser, findUser, addUserSession, updateSystemSettings,
    addSupplier, updateSupplier, removeSupplier,
    addCustomer, updateCustomer, removeCustomer,
    addAccountReceivable, updateAccountReceivable, removeAccountReceivable,
    addBankAccount, updateBankAccount, removeBankAccount,
    addBankTransfer, updateBankTransfer, removeBankTransfer,
    addCostCenter, updateCostCenter, removeCostCenter,
    addBudget, updateBudget, removeBudget,
    addRecurringTransaction, updateRecurringTransaction, removeRecurringTransaction,
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
