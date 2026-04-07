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

// ─── Initial Data (Exported for use in app-context) ────────────────────
export const initialRooms: Room[] = (seedData.rooms as SeedRoom[]).map(transformRoom)
export const initialReservations: Reservation[] = (seedData.reservations as SeedReservation[]).map(transformReservation)
export const initialGuests: GuestProfile[] = seedData.guests as GuestProfile[]
export const initialExpenses: Expense[] = (seedData.expenses as SeedExpense[]).map(transformExpense)
export const initialTransactions: Transaction[] = (seedData.transactions as SeedTransaction[]).map(transformTransaction)
export const initialAuditLog: AuditEntry[] = (seedData.auditLog as SeedAuditEntry[]).map(transformAuditEntry)
export const initialCategories: ExpenseCategory[] = seedData.expenseCategories as ExpenseCategory[]
export const initialCashCloses: CashClose[] = (seedData.cashCloses as SeedCashClose[]).map(transformCashClose)
export const initialPOSProducts: POSProduct[] = seedData.posProducts as POSProduct[]
export const initialPOSSales: POSSale[] = (seedData.posSales as SeedPOSSale[]).map(s => transformPOSSale(s, initialPOSProducts))

// ─── Config Constants (from seed data) ─────────────────────────────────
export const ROOM_TYPES = seedData.roomTypes as string[]
export const PRODUCT_CATEGORIES = seedData.productCategories as string[]
export const PAYMENT_METHODS = seedData.paymentMethods as string[]
export const RESERVATION_STATUSES = seedData.reservationStatuses as ReservationStatus[]
export const ROOM_STATUSES = seedData.roomStatuses as RoomStatus[]
export const TRANSACTION_TYPES = seedData.transactionTypes as TransactionType[]
export const CANCEL_TREATMENTS = seedData.cancelTreatments as CancelTreatment[]
