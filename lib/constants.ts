/**
 * Application-wide constants and configuration values
 */

/**
 * Supervisor password for privileged operations
 */
export const SUPERVISOR_PASSWORD = "admin"

/**
 * Default checkout time for rooms
 */
export const DEFAULT_CHECKOUT_TIME = "12:00"

/**
 * Available payment methods for transactions
 */
export const PAYMENT_METHODS = [
  { id: "dinheiro", label: "Dinheiro", icon: "Banknote" },
  { id: "cartao_debito", label: "Cartao Debito", icon: "CreditCard" },
  { id: "cartao_credito", label: "Cartao Credito", icon: "CreditCard" },
  { id: "pix", label: "PIX", icon: "QrCode" },
] as const

/**
 * Product categories for POS system
 */
export const PRODUCT_CATEGORIES = [
  "Bebidas",
  "Alimentos",
  "Higiene",
  "Servicos",
  "Outros",
] as const

/**
 * Room status types
 */
export const ROOM_STATUS = {
  AVAILABLE: "disponivel",
  OCCUPIED: "ocupado",
  CLEANING: "limpeza",
  BLOCKED: "bloqueado",
} as const

/**
 * Reservation status types
 */
export const RESERVATION_STATUS = {
  CONFIRMED: "confirmada",
  CHECKED_IN: "checkin",
  CHECKED_OUT: "checkout",
  CANCELLED: "cancelada",
  NO_SHOW: "noshow",
} as const

/**
 * Transaction types
 */
export const TRANSACTION_TYPE = {
  REVENUE: "receita",
  EXPENSE: "despesa",
  REFUND: "estorno",
} as const

/**
 * POS sale status types
 */
export const POS_SALE_STATUS = {
  COMPLETED: "concluida",
  CANCELLED: "cancelada",
} as const

/**
 * Default discount ceiling for operators (percentage)
 */
export const DEFAULT_DISCOUNT_CEILING = 5

/**
 * Maximum discount allowed (percentage)
 */
export const MAX_DISCOUNT = 100

/**
 * Minimum discount allowed (percentage)
 */
export const MIN_DISCOUNT = 0
