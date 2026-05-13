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
  // Campos opcionais para logs detalhados (versão híbrida)
  entityType?: string
  entityId?: string | number
  operation?: "create" | "update" | "delete" | "action"
  metadata?: {
    before?: Record<string, any>
    after?: Record<string, any>
    ip?: string
    userAgent?: string
    duration?: number
    [key: string]: any
  }
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
  supplierId?: string // Vincula a fornecedor
  value: number
  dueDate: string
  paid: boolean
  paymentDate?: string
  installments?: ExpenseInstallment[]
}

export interface ExpenseInstallment {
  id: string
  installmentNumber: number
  value: number
  dueDate: string
  paid: boolean
  paymentDate?: string
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
  accountId?: string // Vincula a conta bancária
  costCenterId?: string // Vincula a centro de custo
  taxAmount?: number // Valor de imposto
  taxType?: string // Tipo de imposto
  grossAmount?: number // Valor bruto antes de impostos
}

export interface AuditEntry {
  id: string
  date: string
  user: string
  action: string
  reference: string
  // Campos opcionais para logs detalhados (versão híbrida)
  entityType?: string        // Tipo da entidade: "Room", "Reservation", "Transaction", etc.
  entityId?: string | number // ID da entidade afetada
  operation?: "create" | "update" | "delete" | "action" // Tipo de operação
  metadata?: {
    before?: Record<string, any>  // Estado anterior (para updates/deletes)
    after?: Record<string, any>   // Estado posterior (para creates/updates)
    ip?: string                   // IP do usuário (se disponível)
    userAgent?: string            // User agent (se disponível)
    duration?: number             // Duração da operação em ms
    [key: string]: any            // Campos customizados adicionais
  }
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

export interface Supplier {
  id: string
  name: string
  cnpj?: string
  email?: string
  phone?: string
  address?: string
  paymentTerms?: string
  notes?: string
  active: boolean
}

export interface Customer {
  id: string
  name: string
  cpfCnpj: string
  email?: string
  phone?: string
  phone2?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  birthDate?: string
  notes?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface AccountReceivable {
  id: string
  customerId?: string
  customerName: string
  description: string
  value: number
  issueDate: string
  dueDate: string
  status: "pendente" | "pago" | "vencido" | "cancelado"
  paymentDate?: string
  category?: string
  invoiceNumber?: string
  notes?: string
  installments?: AccountReceivableInstallment[]
}

export interface AccountReceivableInstallment {
  id: string
  installmentNumber: number
  value: number
  dueDate: string
  status: "pendente" | "pago" | "vencido"
  paymentDate?: string
}

export interface BankAccount {
  id: string
  name: string
  type: "caixa" | "conta_corrente" | "poupanca" | "cartao"
  bank?: string
  agency?: string
  accountNumber?: string
  initialBalance: number
  currentBalance: number
  active: boolean
}

export interface BankTransfer {
  id: string
  date: string
  fromAccountId: string
  toAccountId: string
  value: number
  description: string
  responsible: string
}

export interface CostCenter {
  id: string
  name: string
  description?: string
  active: boolean
}

export interface Budget {
  id: string
  name: string
  year: number
  month?: number
  categories: BudgetCategory[]
  status: "ativo" | "arquivado"
}

export interface BudgetCategory {
  categoryId: string
  categoryName: string
  plannedAmount: number
  spentAmount: number
  variance: number
  variancePercent: number
}

export interface RecurringTransaction {
  id: string
  description: string
  value: number
  type: "receita" | "despesa"
  category: string
  accountId?: string
  frequency: "diaria" | "semanal" | "mensal" | "anual"
  dayOfMonth?: number
  dayOfWeek?: number
  startDate: string
  endDate?: string
  active: boolean
  lastGenerated?: string
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
  categoryId: string // References ProductCategory.id
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
  notifyCheckInReminder?: boolean
  notifyCheckOutReminder?: boolean
  notifyLowStock?: boolean
  notifyPendingPayments?: boolean
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

// Helper function to migrate old category names to new categoryIds
function migrateCategoryToId(oldCategory: string): string {
  const categoryMap: Record<string, string> = {
    'Bebidas': 'pcat-bebidas',
    'Lanches': 'pcat-lanches',
    'Doces': 'pcat-doces',
    'Servicos': 'pcat-servicos',
    'Frigobar': 'pcat-frigobar',
    'Outros': 'pcat-outros',
    'Entradas': 'pcat-entradas',
    'Pratos Principais': 'pcat-pratos',
    'Sobremesas': 'pcat-sobremesas',
    'Acompanhamentos': 'pcat-acompanhamentos',
  }
  return categoryMap[oldCategory] || 'pcat-sem-categoria'
}

export const initialPOSProducts: POSProduct[] = (seedData.posProducts as any[]).map(p => ({
  ...p,
  categoryId: migrateCategoryToId(p.category),
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

// ─── Product Categories Initial Data ───────────────────────────────────
export const initialProductCategories: ProductCategory[] = [
  // PDV Categories
  { id: "pcat-bebidas", name: "Bebidas", color: "#3b82f6", icon: "Coffee", active: true, isRestaurant: false },
  { id: "pcat-lanches", name: "Lanches", color: "#f59e0b", icon: "Sandwich", active: true, isRestaurant: false },
  { id: "pcat-doces", name: "Doces", color: "#ec4899", icon: "Cake", active: true, isRestaurant: false },
  { id: "pcat-servicos", name: "Servicos", color: "#8b5cf6", icon: "Wrench", active: true, isRestaurant: false },
  { id: "pcat-frigobar", name: "Frigobar", color: "#06b6d4", icon: "Refrigerator", active: true, isRestaurant: false },
  { id: "pcat-outros", name: "Outros", color: "#6b7280", icon: "Package", active: true, isRestaurant: false },
  // Restaurant Categories
  { id: "pcat-entradas", name: "Entradas", color: "#10b981", icon: "Salad", active: true, isRestaurant: true },
  { id: "pcat-pratos", name: "Pratos Principais", color: "#ef4444", icon: "UtensilsCrossed", active: true, isRestaurant: true },
  { id: "pcat-sobremesas", name: "Sobremesas", color: "#f97316", icon: "IceCream", active: true, isRestaurant: true },
  { id: "pcat-bebidas-rest", name: "Bebidas", color: "#3b82f6", icon: "GlassWater", active: true, isRestaurant: true },
  { id: "pcat-acompanhamentos", name: "Acompanhamentos", color: "#84cc16", icon: "Soup", active: true, isRestaurant: true },
  // Fallback category
  { id: "pcat-sem-categoria", name: "Sem Categoria", color: "#9ca3af", icon: "HelpCircle", active: true, isRestaurant: false },
]

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
  notifyCheckInReminder: true,
  notifyCheckOutReminder: true,
  notifyLowStock: true,
  notifyPendingPayments: true,
}

// ─── Dynamic Timeline Calculation ──────────────────────────────────────
/**
 * Calculates the timeline for a room based on its current state, reservations, and blocks.
 * This function dynamically generates the timeline for a given date range.
 * 
 * @param room - The room to calculate timeline for
 * @param reservations - All reservations in the system
 * @param startDate - Start date in ISO format (YYYY-MM-DD)
 * @param days - Number of days to calculate (default: 7)
 * @returns Array of TimelineDay objects
 */
export function calculateRoomTimeline(
  room: Room,
  reservations: Reservation[],
  startDate: string,
  days: number = 7
): TimelineDay[] {
  const timeline: TimelineDay[] = []
  const start = new Date(startDate + "T00:00:00")
  
  // Get reservations for this room that are confirmed or checked-in
  const roomReservations = reservations.filter(
    r => r.roomId === room.id && (r.status === "confirmada" || r.status === "checkin")
  )

  for (let i = 0; i < days; i++) {
    const currentDate = new Date(start)
    currentDate.setDate(currentDate.getDate() + i)
    const dateISO = currentDate.toISOString().split("T")[0]
    
    // Format label
    const day = currentDate.getDate()
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    const label = `${day} ${months[currentDate.getMonth()]}`
    
    // Determine status for this date
    let status: RoomStatus = "disponivel"
    
    // Check if room is blocked on this date
    if (room.status === "bloqueado" && room.blockEndDate) {
      const blockEnd = new Date(room.blockEndDate + "T23:59:59")
      if (currentDate <= blockEnd) {
        status = "bloqueado"
      }
    }
    
    // Check if there's a reservation covering this date
    if (status !== "bloqueado") {
      for (const reservation of roomReservations) {
        const checkIn = new Date(reservation.checkIn + "T00:00:00")
        const checkOut = new Date(reservation.checkOut + "T23:59:59")
        
        if (currentDate >= checkIn && currentDate <= checkOut) {
          status = "ocupado"
          break
        }
      }
    }
    
    // If it's today and room is currently in limpeza, show limpeza
    const today = new Date().toISOString().split("T")[0]
    if (dateISO === today && room.status === "limpeza") {
      status = "limpeza"
    }
    
    // If it's today, use the current room status (unless overridden by reservation/block)
    if (dateISO === today && status === "disponivel") {
      status = room.status
    }
    
    timeline.push({
      date: dateISO,
      label,
      status,
    })
  }
  
  return timeline
}

// ─── Restaurant Config Constants ───────────────────────────────────────
export const TABLE_STATUSES: TableStatus[] = ["livre", "ocupada", "reservada"]
export const ORDER_STATUSES: OrderStatus[] = ["aberta", "fechada", "cancelada"]
export const STOCK_UNITS: StockUnit[] = ["kg", "un", "lt", "cx"]
export const MOVEMENT_TYPES: MovementType[] = ["entrada", "saida", "ajuste", "perda"]
export const EMPLOYEE_ROLES: EmployeeRole[] = ["caixa", "cozinha", "atendimento", "gerente", "supervisor"]
export const CONSUMPTION_PAYMENT_TYPES: ConsumptionPaymentType[] = ["beneficio", "desconto", "pago"]
