"use client"

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react"
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
  type ExpenseCategory, type CashClose, type RoomStatus,
  type RoomConsumption, type ConsumptionItem,
  type POSProduct, type POSSale,
  type RestaurantTable, type RestaurantOrder, type RestaurantOrderItem,
  type StockItem, type StockMovement,
  type Recipe, type Production,
  type Employee, type EmployeeConsumption, type EmployeeConsumptionItem,
  type ProductCategory,
} from "./store"

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
  updateRoom: (id: number, data: Partial<Room>) => void
  addRoom: (room: Room) => void
  removeRoom: (id: number) => void
  addReservation: (r: Reservation) => void
  updateReservation: (id: string, data: Partial<Reservation>) => void
  addExpense: (e: Expense) => void
  updateExpense: (id: string, data: Partial<Expense>) => void
  addTransaction: (t: Transaction) => void
  addAuditEntry: (entry: Omit<AuditEntry, "id" | "date">) => void
  addCategory: (label: string) => void
  addCashClose: (c: CashClose) => void
  findGuest: (cpf: string) => GuestProfile | undefined
  addGuest: (g: GuestProfile) => void
  setDiscountCeiling: (v: number) => void
  addConsumptionItem: (roomId: number, item: ConsumptionItem) => void
  removeConsumptionItem: (roomId: number, itemId: string) => void
  getConsumption: (roomId: number) => RoomConsumption | undefined
  clearConsumption: (roomId: number) => void
  addPOSProduct: (p: POSProduct) => void
  updatePOSProduct: (id: string, data: Partial<POSProduct>) => void
  removePOSProduct: (id: string) => void
  addPOSSale: (s: POSSale) => void
  updatePOSSale: (id: string, data: Partial<POSSale>) => void
  addProductCategory: (c: ProductCategory) => void
  updateProductCategory: (id: string, data: Partial<ProductCategory>) => void
  removeProductCategory: (id: string) => void
  addRestaurantTable: (t: RestaurantTable) => void
  updateRestaurantTable: (id: number, data: Partial<RestaurantTable>) => void
  removeRestaurantTable: (id: number) => void
  addRestaurantOrder: (o: RestaurantOrder) => void
  updateRestaurantOrder: (id: string, data: Partial<RestaurantOrder>) => void
  addOrderItem: (orderId: string, item: RestaurantOrderItem) => void
  removeOrderItem: (orderId: string, itemId: string) => void
  addStockItem: (s: StockItem) => void
  updateStockItem: (id: string, data: Partial<StockItem>) => void
  addStockMovement: (m: StockMovement) => void
  addRecipe: (r: Recipe) => void
  updateRecipe: (id: string, data: Partial<Recipe>) => void
  addProduction: (p: Production) => void
  addEmployee: (e: Employee) => void
  updateEmployee: (id: string, data: Partial<Employee>) => void
  addEmployeeConsumption: (c: EmployeeConsumption) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [guests, setGuests] = useState<GuestProfile[]>(initialGuests)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(initialAuditLog)
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories)
  const [cashCloses, setCashCloses] = useState<CashClose[]>(initialCashCloses)
  const [consumptions, setConsumptions] = useState<RoomConsumption[]>([])
  const [discountCeiling, setDiscountCeiling] = useState(5)
  const [posProducts, setPOSProducts] = useState<POSProduct[]>(initialPOSProducts)
  const [posSales, setPOSSales] = useState<POSSale[]>(initialPOSSales)
  
  // Restaurant states
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([])
  const [restaurantTables, setRestaurantTables] = useState<RestaurantTable[]>(initialRestaurantTables)
  const [restaurantOrders, setRestaurantOrders] = useState<RestaurantOrder[]>(initialRestaurantOrders)
  const [stockItems, setStockItems] = useState<StockItem[]>(initialStockItems)
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(initialStockMovements)
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes)
  const [productions, setProductions] = useState<Production[]>(initialProductions)
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [employeeConsumptions, setEmployeeConsumptions] = useState<EmployeeConsumption[]>(initialEmployeeConsumptions)

  const updateRoom = useCallback((id: number, data: Partial<Room>) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
  }, [])

  const addRoom = useCallback((room: Room) => {
    setRooms(prev => [...prev, room])
  }, [])

  const removeRoom = useCallback((id: number) => {
    setRooms(prev => prev.filter(r => r.id !== id))
  }, [])

  const addReservation = useCallback((r: Reservation) => {
    setReservations(prev => [...prev, r])
  }, [])

  const updateReservation = useCallback((id: string, data: Partial<Reservation>) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
  }, [])

  const addExpense = useCallback((e: Expense) => {
    setExpenses(prev => [...prev, e])
  }, [])

  const updateExpense = useCallback((id: string, data: Partial<Expense>) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
  }, [])

  const addTransaction = useCallback((t: Transaction) => {
    setTransactions(prev => [...prev, t])
  }, [])

  const addAuditEntry = useCallback((entry: Omit<AuditEntry, "id" | "date">) => {
    setAuditLog(prev => [{
      ...entry,
      id: `A${String(prev.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString(),
    }, ...prev])
  }, [])

  const addCategory = useCallback((label: string) => {
    setCategories(prev => [...prev, { id: `C${String(prev.length + 1).padStart(3, "0")}`, label }])
  }, [])

  const addCashClose = useCallback((c: CashClose) => {
    setCashCloses(prev => [...prev, c])
  }, [])

  const findGuest = useCallback((cpf: string) => {
    return guests.find(g => g.cpf === cpf)
  }, [guests])

  const addGuest = useCallback((g: GuestProfile) => {
    setGuests(prev => {
      const exists = prev.find(p => p.cpf === g.cpf)
      if (exists) return prev
      return [...prev, g]
    })
  }, [])

  const addConsumptionItem = useCallback((roomId: number, item: ConsumptionItem) => {
    setConsumptions(prev => {
      const existing = prev.find(c => c.roomId === roomId)
      if (existing) {
        return prev.map(c => c.roomId === roomId
          ? { ...c, items: [...c.items, item] }
          : c
        )
      }
      return [...prev, { roomId, items: [item] }]
    })
  }, [])

  const removeConsumptionItem = useCallback((roomId: number, itemId: string) => {
    setConsumptions(prev =>
      prev.map(c => c.roomId === roomId
        ? { ...c, items: c.items.filter(i => i.id !== itemId) }
        : c
      )
    )
  }, [])

  const getConsumption = useCallback((roomId: number) => {
    return consumptions.find(c => c.roomId === roomId)
  }, [consumptions])

  const clearConsumption = useCallback((roomId: number) => {
    setConsumptions(prev => prev.filter(c => c.roomId !== roomId))
  }, [])

  const addPOSProduct = useCallback((p: POSProduct) => {
    setPOSProducts(prev => [...prev, p])
  }, [])

  const updatePOSProduct = useCallback((id: string, data: Partial<POSProduct>) => {
    setPOSProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
  }, [])

  const removePOSProduct = useCallback((id: string) => {
    setPOSProducts(prev => prev.filter(p => p.id !== id))
  }, [])

  const addPOSSale = useCallback((s: POSSale) => {
    setPOSSales(prev => [...prev, s])
  }, [])

  const updatePOSSale = useCallback((id: string, data: Partial<POSSale>) => {
    setPOSSales(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
  }, [])

  // Restaurant methods - Product Categories
  const addProductCategory = useCallback((c: ProductCategory) => {
    setProductCategories(prev => [...prev, c])
  }, [])

  const updateProductCategory = useCallback((id: string, data: Partial<ProductCategory>) => {
    setProductCategories(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
  }, [])

  const removeProductCategory = useCallback((id: string) => {
    setProductCategories(prev => prev.filter(c => c.id !== id))
  }, [])

  // Restaurant methods - Tables
  const addRestaurantTable = useCallback((t: RestaurantTable) => {
    setRestaurantTables(prev => [...prev, t])
  }, [])

  const updateRestaurantTable = useCallback((id: number, data: Partial<RestaurantTable>) => {
    setRestaurantTables(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
  }, [])

  const removeRestaurantTable = useCallback((id: number) => {
    setRestaurantTables(prev => prev.filter(t => t.id !== id))
  }, [])

  // Restaurant methods - Orders
  const addRestaurantOrder = useCallback((o: RestaurantOrder) => {
    setRestaurantOrders(prev => [...prev, o])
  }, [])

  const updateRestaurantOrder = useCallback((id: string, data: Partial<RestaurantOrder>) => {
    setRestaurantOrders(prev => prev.map(o => o.id === id ? { ...o, ...data } : o))
  }, [])

  const addOrderItem = useCallback((orderId: string, item: RestaurantOrderItem) => {
    setRestaurantOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, items: [...o.items, item] } : o
    ))
  }, [])

  const removeOrderItem = useCallback((orderId: string, itemId: string) => {
    setRestaurantOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, items: o.items.filter(i => i.id !== itemId) } : o
    ))
  }, [])

  // Restaurant methods - Stock
  const addStockItem = useCallback((s: StockItem) => {
    setStockItems(prev => [...prev, s])
  }, [])

  const updateStockItem = useCallback((id: string, data: Partial<StockItem>) => {
    setStockItems(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
  }, [])

  const addStockMovement = useCallback((m: StockMovement) => {
    setStockMovements(prev => [...prev, m])
    // Update stock quantity based on movement type
    if (m.type === "entrada") {
      updateStockItem(m.productId, { 
        currentStock: (stockItems.find(s => s.productId === m.productId)?.currentStock || 0) + m.quantity 
      })
    } else if (m.type === "saida" || m.type === "perda") {
      updateStockItem(m.productId, { 
        currentStock: (stockItems.find(s => s.productId === m.productId)?.currentStock || 0) - m.quantity 
      })
    }
  }, [stockItems, updateStockItem])

  // Restaurant methods - Recipes
  const addRecipe = useCallback((r: Recipe) => {
    setRecipes(prev => [...prev, r])
  }, [])

  const updateRecipe = useCallback((id: string, data: Partial<Recipe>) => {
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
  }, [])

  // Restaurant methods - Production
  const addProduction = useCallback((p: Production) => {
    setProductions(prev => [...prev, p])
  }, [])

  // Restaurant methods - Employees
  const addEmployee = useCallback((e: Employee) => {
    setEmployees(prev => [...prev, e])
  }, [])

  const updateEmployee = useCallback((id: string, data: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
  }, [])

  // Restaurant methods - Employee Consumption
  const addEmployeeConsumption = useCallback((c: EmployeeConsumption) => {
    setEmployeeConsumptions(prev => [...prev, c])
  }, [])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    rooms, reservations, guests, expenses, transactions,
    auditLog, categories, cashCloses, consumptions, discountCeiling,
    posProducts, posSales,
    productCategories, restaurantTables, restaurantOrders,
    stockItems, stockMovements, recipes, productions,
    employees, employeeConsumptions,
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
  }), [
    rooms, reservations, guests, expenses, transactions,
    auditLog, categories, cashCloses, consumptions, discountCeiling,
    posProducts, posSales,
    productCategories, restaurantTables, restaurantOrders,
    stockItems, stockMovements, recipes, productions,
    employees, employeeConsumptions,
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
