import seedData from "./seed-data.json"

// ─── Seed Data Interfaces (Raw JSON structure) ─────────────────────────
export interface SeedRoom {
  id: number
  number: string
  type: string
  status: RoomStatus
  guest?: string
  guestCpf?: string
  checkOutTime?: string
  checkInOffset?: number
  checkOutOffset?: number
  blockReason?: string
  blockEndDateOffset?: number
  blockResponsible?: string
  timelinePattern: RoomStatus[]
}

export interface SeedReservation {
  id: string
  roomId: number
  roomNumber: string
  guestName: string
  cpf: string
  checkInOffset: number
  checkOutOffset: number
  status: ReservationStatus
  totalValue: number
  cancelTreatment?: CancelTreatment
}

export interface SeedExpense {
  id: string
  description: string
  category: string
  value: number
  dueDateOffset: number
  paid: boolean
}

export interface SeedTransaction {
  id: string
  dateOffset: number
  description: string
  value: number
  type: TransactionType
  category?: string
  paymentMethod?: string
  responsible?: string
  notes?: string
}

export interface SeedAuditEntry {
  id: string
  hoursAgo: number
  user: string
  action: string
  reference: string
}

export interface SeedCashClose {
  id: string
  hoursAgo: number
  operator: string
  physicalValue: number
  expectedValue: number
  divergence: number
}

export interface SeedPOSSaleItem {
  id: string
  productId: string
  quantity: number
  discount: number
}

export interface SeedPOSSale {
  id: string
  hoursAgo: number
  items: SeedPOSSaleItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: string
  amountPaid: number
  change: number
  customer?: string
  operator: string
  status: POSSaleStatus
  cancelReason?: string
}

// ─── Restaurant Seed Data Interfaces ───────────────────────────────────
export interface SeedRestaurantTable {
  id: number
  number: string
  capacity: number
  status: TableStatus
  currentOrderId?: string
  openedAtHoursAgo?: number
}

export interface SeedRestaurantOrderItem {
  id: string
  productId: string
  quantity: number
}

export interface SeedRestaurantOrder {
  id: string
  tableId: number
  hoursAgo: number
  items: SeedRestaurantOrderItem[]
  subtotal: number
  discount: number
  total: number
  status: OrderStatus
  paymentMethod?: string
  amountPaid?: number
  change?: number
  customer?: string
  operator: string
  cancelReason?: string
}

export interface SeedStockItem {
  id: string
  productId: string
  currentStock: number
  unit: StockUnit
  minimumStock: number
  maximumStock: number
  averageCost: number
  lastPurchasePrice: number
  lastPurchaseDaysAgo?: number
}

export interface SeedEmployee {
  id: string
  name: string
  cpf: string
  photo?: string
  role: EmployeeRole
  active: boolean
  consumptionLimit: number
  mealBenefit: {
    lunchIncluded: boolean
    dinnerIncluded: boolean
    snackIncluded: boolean
  }
}

// ─── Application Types (Runtime structure) ─────────────────────────────
export type RoomStatus = "disponivel" | "ocupado" | "limpeza" | "bloqueado"
export type ReservationStatus = "confirmada" | "checkin" | "checkout" | "cancelada" | "noshow"
export type TransactionType = "receita" | "despesa" | "estorno"
export type CancelTreatment = "estorno" | "multa" | "credito"
export type POSSaleStatus = "concluida" | "cancelada"
export type UserRole = "operador" | "supervisor"

export interface TimelineDay {
  date: string
  label: string
  status: RoomStatus
}

export interface Room {
  id: number
  number: string
  type: string
  status: RoomStatus
  guest?: string
  guestCpf?: string
  checkIn?: string
  checkOut?: string
  checkOutTime?: string
  blockReason?: string
  blockEndDate?: string
  blockResponsible?: string
  timeline: TimelineDay[]
}

export interface Reservation {
  id: string
  roomId: number
  roomNumber: string
  guestName: string
  cpf: string
  checkIn: string
  checkOut: string
  status: ReservationStatus
  totalValue: number
  cancelTreatment?: CancelTreatment
}

export interface GuestProfile {
  cpf: string
  name: string
  totalStays: number
  avgTicket: number
  noShows: number
}

export interface Expense {
  id: string
  description: string
  category: string
  value: number
  dueDate: string
  paid: boolean
}

export interface Transaction {
  id: string
  date: string
  description: string
  value: number
  type: TransactionType
  refId?: string
  category?: string
  paymentMethod?: string
  responsible?: string
  notes?: string
}

export interface AuditEntry {
  id: string
  date: string
  user: string
  action: string
  reference: string
}

export interface CashClose {
  id: string
  date: string
  operator: string
  physicalValue: number
  expectedValue: number
  divergence: number
}

export interface ExpenseCategory {
  id: string
  label: string
}

export interface ConsumptionItem {
  id: string
  label: string
  unitPrice: number
  quantity: number
}

export interface RoomConsumption {
  roomId: number
  items: ConsumptionItem[]
}

export interface POSProduct {
  id: string
  name: string
  category: string
  price: number
  barcode?: string
  trackStock: boolean // Controls stock integration - if true, requires StockItem
}

export interface POSCartItem {
  id: string
  product: POSProduct
  quantity: number
  discount: number
}

export interface POSSale {
  id: string
  date: string
  items: POSCartItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: string
  amountPaid: number
  change: number
  customer?: string
  operator: string
  status: POSSaleStatus
  cancelReason?: string
}

// ─── Restaurant Types ──────────────────────────────────────────────────
export type TableStatus = "livre" | "ocupada" | "reservada"
export type OrderStatus = "aberta" | "fechada" | "cancelada"
export type StockUnit = "kg" | "un" | "lt" | "cx"
export type MovementType = "entrada" | "saida" | "ajuste" | "perda"
export type EmployeeRole = "caixa" | "cozinha" | "atendimento" | "gerente" | "supervisor"
export type ConsumptionPaymentType = "beneficio" | "desconto" | "pago"

export interface ProductCategory {
  id: string
  name: string
  color: string
  icon: string
  active: boolean
  isRestaurant: boolean // true for restaurant categories, false for pousada
}

export interface RestaurantTable {
  id: number
  number: string
  capacity: number
  status: TableStatus
  currentOrderId?: string
  openedAt?: string
}

export interface RestaurantOrderItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
  category: string
}

export interface RestaurantOrder {
  id: string
  tableId: number
  tableNumber: string
  items: RestaurantOrderItem[]
  subtotal: number
  discount: number
  total: number
  status: OrderStatus
  openedAt: string
  closedAt?: string
  paymentMethod?: string
  amountPaid?: number
  change?: number
  customer?: string
  operator: string
  cancelReason?: string
}

export interface StockItem {
  id: string
  productId: string
  productName: string
  currentStock: number
  unit: StockUnit
  minimumStock: number
  maximumStock: number
  averageCost: number
  lastPurchasePrice: number
  lastPurchaseDate?: string
}

export interface StockMovement {
  id: string
  type: MovementType
  productId: string
  productName: string
  quantity: number
  unit: StockUnit
  cost?: number
  reason: string
  timestamp: string
  registeredBy: string
  invoiceNumber?: string
  expirationDate?: string
  notes?: string
}

export interface RecipeIngredient {
  productId: string
  productName: string
  quantity: number
  unit: StockUnit
  cost: number
}

export interface Recipe {
  id: string
  name: string
  category: string
  version: number
  ingredients: RecipeIngredient[]
  expectedYield: number
  yieldUnit: StockUnit
  preparationTime: number
  instructions: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Production {
  id: string
  recipeId: string
  recipeName: string
  plannedQuantity: number
  producedQuantity: number
  yield: number
  totalCost: number
  unitCost: number
  timestamp: string
  producedBy: string
  notes?: string
}

export interface Employee {
  id: string
  name: string
  cpf: string
  photo?: string
  role: EmployeeRole
  active: boolean
  consumptionLimit: number
  mealBenefit: {
    lunchIncluded: boolean
    dinnerIncluded: boolean
    snackIncluded: boolean
  }
}

// ─── User Management Types ─────────────────────────────────────────────
export interface User {
  id: string
  username: string
  password: string // In production, this would be hashed
  role: UserRole
  fullName: string
  email?: string
  active: boolean
  createdAt: string
  createdBy: string
  lastLogin?: string
}

export interface UserSession {
  id: string
  userId: string
  username: string
  loginTime: string
  logoutTime?: string
}

export interface SystemSettings {
  id: string
  pousadaName: string
  checkInTime: string // HH:mm format
  checkOutTime: string // HH:mm format
  discountCeiling: number
  contactPhone?: string
  contactEmail?: string
  address?: string
}

export interface EmployeeConsumptionItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface EmployeeConsumption {
  id: string
  employeeId: string
  employeeName: string
  items: EmployeeConsumptionItem[]
  total: number
  category: string
  timestamp: string
  registeredBy: string
  paymentType: ConsumptionPaymentType
  notes?: string
}

// ─── Helper Functions ──────────────────────────────────────────────────
function getDateISO(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().split("T")[0]
}

function getDateLabel(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const day = date.getDate()
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${day} ${months[date.getMonth()]}`
}

function generateTimeline(pattern: RoomStatus[]): TimelineDay[] {
  return pattern.map((status, i) => ({
    date: getDateISO(i),
    label: getDateLabel(i),
    status,
  }))
}

function getDateFromHoursAgo(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3600000).toISOString()
}

// ─── Transformers (Seed -> Runtime) ────────────────────────────────────
function transformRoom(seed: SeedRoom): Room {
  return {
    id: seed.id,
    number: seed.number,
    type: seed.type,
    status: seed.status,
    guest: seed.guest,
    guestCpf: seed.guestCpf,
    checkIn: seed.checkInOffset !== undefined ? getDateISO(seed.checkInOffset) : undefined,
    checkOut: seed.checkOutOffset !== undefined ? getDateISO(seed.checkOutOffset) : undefined,
    checkOutTime: seed.checkOutTime,
    blockReason: seed.blockReason,
    blockEndDate: seed.blockEndDateOffset !== undefined ? getDateISO(seed.blockEndDateOffset) : undefined,
    blockResponsible: seed.blockResponsible,
    timeline: generateTimeline(seed.timelinePattern),
  }
}

function transformReservation(seed: SeedReservation): Reservation {
  return {
    id: seed.id,
    roomId: seed.roomId,
    roomNumber: seed.roomNumber,
    guestName: seed.guestName,
    cpf: seed.cpf,
    checkIn: getDateISO(seed.checkInOffset),
    checkOut: getDateISO(seed.checkOutOffset),
    status: seed.status,
    totalValue: seed.totalValue,
    cancelTreatment: seed.cancelTreatment,
  }
}

function transformExpense(seed: SeedExpense): Expense {
  return {
    id: seed.id,
    description: seed.description,
    category: seed.category,
    value: seed.value,
    dueDate: getDateISO(seed.dueDateOffset),
    paid: seed.paid,
  }
}

function transformTransaction(seed: SeedTransaction): Transaction {
  return {
    id: seed.id,
    date: getDateISO(seed.dateOffset),
    description: seed.description,
    value: seed.value,
    type: seed.type,
    category: seed.category,
    paymentMethod: seed.paymentMethod,
    responsible: seed.responsible,
    notes: seed.notes,
  }
}

function transformAuditEntry(seed: SeedAuditEntry): AuditEntry {
  return {
    id: seed.id,
    date: getDateFromHoursAgo(seed.hoursAgo),
    user: seed.user,
    action: seed.action,
    reference: seed.reference,
  }
}

function transformCashClose(seed: SeedCashClose): CashClose {
  return {
    id: seed.id,
    date: getDateFromHoursAgo(seed.hoursAgo),
    operator: seed.operator,
    physicalValue: seed.physicalValue,
    expectedValue: seed.expectedValue,
    divergence: seed.divergence,
  }
}

function transformPOSSale(seed: SeedPOSSale, products: POSProduct[]): POSSale {
  const productMap = new Map(products.map(p => [p.id, p]))
  return {
    id: seed.id,
    date: getDateFromHoursAgo(seed.hoursAgo),
    items: seed.items.map(item => ({
      id: item.id,
      product: productMap.get(item.productId) || { id: item.productId, name: "Produto Removido", category: "Outros", price: 0 },
      quantity: item.quantity,
      discount: item.discount,
    })),
    subtotal: seed.subtotal,
    discount: seed.discount,
    total: seed.total,
    paymentMethod: seed.paymentMethod,
    amountPaid: seed.amountPaid,
    change: seed.change,
    customer: seed.customer,
    operator: seed.operator,
    status: seed.status,
    cancelReason: seed.cancelReason,
  }
}

function transformRestaurantTable(seed: SeedRestaurantTable): RestaurantTable {
  return {
    id: seed.id,
    number: seed.number,
    capacity: seed.capacity,
    status: seed.status,
    currentOrderId: seed.currentOrderId,
    openedAt: seed.openedAtHoursAgo !== undefined ? getDateFromHoursAgo(seed.openedAtHoursAgo) : undefined,
  }
}

function transformRestaurantOrder(seed: SeedRestaurantOrder, products: POSProduct[], tables: RestaurantTable[]): RestaurantOrder {
  const productMap = new Map(products.map(p => [p.id, p]))
  const table = tables.find(t => t.id === seed.tableId)
  return {
    id: seed.id,
    tableId: seed.tableId,
    tableNumber: table?.number || `Mesa ${seed.tableId}`,
    items: seed.items.map(item => {
      const product = productMap.get(item.productId) || { id: item.productId, name: "Produto Removido", category: "Outros", price: 0 }
      return {
        id: item.id,
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal: product.price * item.quantity,
        category: product.category,
      }
    }),
    subtotal: seed.subtotal,
    discount: seed.discount,
    total: seed.total,
    status: seed.status,
    openedAt: getDateFromHoursAgo(seed.hoursAgo),
    closedAt: seed.status === "fechada" ? getDateFromHoursAgo(seed.hoursAgo - 1) : undefined,
    paymentMethod: seed.paymentMethod,
    amountPaid: seed.amountPaid,
    change: seed.change,
    customer: seed.customer,
    operator: seed.operator,
    cancelReason: seed.cancelReason,
  }
}

function transformStockItem(seed: SeedStockItem, products: POSProduct[]): StockItem {
  const product = products.find(p => p.id === seed.productId)
  return {
    id: seed.id,
    productId: seed.productId,
    productName: product?.name || "Produto Desconhecido",
    currentStock: seed.currentStock,
    unit: seed.unit,
    minimumStock: seed.minimumStock,
    maximumStock: seed.maximumStock,
    averageCost: seed.averageCost,
    lastPurchasePrice: seed.lastPurchasePrice,
    lastPurchaseDate: seed.lastPurchaseDaysAgo !== undefined ? getDateISO(-seed.lastPurchaseDaysAgo) : undefined,
  }
}

// ─── Initial Data (Exported for use in app-context) ────────────────────
export const initialRooms: Room[] = (seedData.rooms as SeedRoom[]).map(transformRoom)
export const initialReservations: Reservation[] = (seedData.reservations as SeedReservation[]).map(transformReservation)
export const initialGuests: GuestProfile[] = seedData.guests as GuestProfile[]
export const initialExpenses: Expense[] = (seedData.expenses as SeedExpense[]).map(transformExpense)
export const initialTransactions: Transaction[] = (seedData.transactions as SeedTransaction[]).map(transformTransaction)
export const initialAuditLog: AuditEntry[] = (seedData.auditLog as SeedAuditEntry[]).map(transformAuditEntry)
export const initialCategories: ExpenseCategory[] = seedData.expenseCategories as ExpenseCategory[]
export const initialCashCloses: CashClose[] = (seedData.cashCloses as SeedCashClose[]).map(transformCashClose)
export const initialPOSProducts: POSProduct[] = (seedData.posProducts as any[]).map(p => ({
  ...p,
  trackStock: false // Default: products don't require stock tracking
}))
export const initialPOSSales: POSSale[] = (seedData.posSales as SeedPOSSale[]).map(s => transformPOSSale(s, initialPOSProducts))

// ─── Config Constants (from seed data) ─────────────────────────────────
export const ROOM_TYPES = seedData.roomTypes as string[]
export const PRODUCT_CATEGORIES = seedData.productCategories as string[]
export const PAYMENT_METHODS = seedData.paymentMethods as string[]
export const RESERVATION_STATUSES = seedData.reservationStatuses as ReservationStatus[]
export const ROOM_STATUSES = seedData.roomStatuses as RoomStatus[]
export const TRANSACTION_TYPES = seedData.transactionTypes as TransactionType[]
export const CANCEL_TREATMENTS = seedData.cancelTreatments as CancelTreatment[]

// ─── Restaurant Initial Data ───────────────────────────────────────────
export const initialRestaurantTables: RestaurantTable[] = (seedData.restaurantTables as SeedRestaurantTable[] || []).map(transformRestaurantTable)
export const initialRestaurantOrders: RestaurantOrder[] = []
export const initialStockItems: StockItem[] = []
export const initialStockMovements: StockMovement[] = []
export const initialRecipes: Recipe[] = []
export const initialProductions: Production[] = []
export const initialEmployees: Employee[] = (seedData.employees as SeedEmployee[] || [])
export const initialEmployeeConsumptions: EmployeeConsumption[] = []

// ─── User Management Initial Data ──────────────────────────────────────
export const initialUsers: User[] = [
  {
    id: "user-supervisor",
    username: "supervisor",
    password: "adm123", // In production, this would be hashed
    role: "supervisor",
    fullName: "Supervisor do Sistema",
    email: "supervisor@pousada.com",
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: "system",
  },
  {
    id: "user-operador",
    username: "operador",
    password: "1234",
    role: "operador",
    fullName: "Operador Padrão",
    email: "operador@pousada.com",
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: "system",
  },
]

export const initialUserSessions: UserSession[] = []

export const initialSystemSettings: SystemSettings = {
  id: "settings-1",
  pousadaName: "Pousada Sol & Mar",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  discountCeiling: 20,
  contactPhone: "(11) 98765-4321",
  contactEmail: "contato@pousadasolemar.com.br",
  address: "Rua das Praias, 123 - Praia Grande, SP",
}

// ─── Restaurant Config Constants ───────────────────────────────────────
export const TABLE_STATUSES: TableStatus[] = ["livre", "ocupada", "reservada"]
export const ORDER_STATUSES: OrderStatus[] = ["aberta", "fechada", "cancelada"]
export const STOCK_UNITS: StockUnit[] = ["kg", "un", "lt", "cx"]
export const MOVEMENT_TYPES: MovementType[] = ["entrada", "saida", "ajuste", "perda"]
export const EMPLOYEE_ROLES: EmployeeRole[] = ["caixa", "cozinha", "atendimento", "gerente", "supervisor"]
export const CONSUMPTION_PAYMENT_TYPES: ConsumptionPaymentType[] = ["beneficio", "desconto", "pago"]
