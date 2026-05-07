/**
 * Centralized application constants
 * Consolidates hardcoded values to ensure consistency across the application
 */

// Locale settings
export const LOCALE = "pt-BR" as const

// Room status constants
export const ROOM_STATUS = {
  AVAILABLE: "disponivel",
  OCCUPIED: "ocupado",
  MAINTENANCE: "manutencao",
} as const

export type RoomStatus = typeof ROOM_STATUS[keyof typeof ROOM_STATUS]

// Date formatting utilities
export function getTodayISO(): string {
  return new Date().toISOString().split("T")[0]
}

export function toDateISO(date: Date): string {
  return date.toISOString().split("T")[0]
}

// Date formatting options
export const DATE_FORMAT_OPTIONS = {
  SHORT: { day: "2-digit", month: "short" } as const,
  NUMERIC_SHORT: { day: "2-digit", month: "2-digit", year: "2-digit" } as const,
  FULL: { weekday: "long", year: "numeric", month: "long", day: "numeric" } as const,
}

// Currency formatting
export const CURRENCY_OPTIONS = {
  style: "currency",
  currency: "BRL",
} as const
