/**
 * Centralized date formatting utilities
 * Consolidates date formatting logic to ensure consistency across the application
 */

import { LOCALE, DATE_FORMAT_OPTIONS, getTodayISO, toDateISO } from "./constants"

/**
 * Format ISO date string to Brazilian short date format (e.g., "07/05/26")
 * Handles both date-only and datetime ISO strings
 * 
 * @param iso - ISO date string (e.g., "2026-05-07" or "2026-05-07T10:30:00")
 * @returns Formatted date string (e.g., "07/05/26")
 */
export function formatDateBR(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00")
  return d.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "2-digit" })
}

/**
 * Format ISO date string to Brazilian date and time format
 * 
 * @param iso - ISO date string with time
 * @returns Formatted date and time string (e.g., "07/05/2026 10:30")
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Format Date object to short format (e.g., "07 mai")
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString(LOCALE, DATE_FORMAT_OPTIONS.SHORT)
}

/**
 * Format Date object to numeric short format (e.g., "07/05/26")
 */
export function formatDateNumericShort(date: Date): string {
  return date.toLocaleDateString(LOCALE, DATE_FORMAT_OPTIONS.NUMERIC_SHORT)
}

/**
 * Format Date object to full format (e.g., "quinta-feira, 7 de maio de 2026")
 */
export function formatDateFull(date: Date): string {
  return date.toLocaleDateString(LOCALE, DATE_FORMAT_OPTIONS.FULL)
}

/**
 * Format Date object to locale string with date and time
 */
export function formatDateTimeFromDate(date: Date): string {
  return date.toLocaleString(LOCALE)
}

/**
 * Format date and time with custom options
 */
export function formatDateTimeCustom(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleString(LOCALE, options)
}

/**
 * Format ISO date string to a short date label (e.g., "7 Mai")
 * 
 * @param offset - Number of days from today (0 = today, 1 = tomorrow, etc.)
 * @returns Formatted date label (e.g., "7 Mai")
 */
export function getDateLabel(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const day = date.getDate()
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${day} ${months[date.getMonth()]}`
}

/**
 * Get ISO date string for a date offset from today
 * 
 * @param offset - Number of days from today (0 = today, 1 = tomorrow, etc.)
 * @returns ISO date string (e.g., "2026-05-07")
 */
export function getDateISO(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().split("T")[0]
}

/**
 * Calculate days until a due date
 * 
 * @param iso - ISO date string of the due date
 * @returns Number of days until due (negative if overdue)
 */
export function daysUntilDue(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(iso + "T12:00:00")
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// Re-export date utilities from constants
export { getTodayISO, toDateISO }
