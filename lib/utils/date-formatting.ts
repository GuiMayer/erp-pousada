/**
 * Centralized date formatting utilities
 * Consolidates date formatting logic to ensure consistency across the application
 */

import { LOCALE, DATE_FORMAT_OPTIONS, getTodayISO, toDateISO } from "./constants"

/**
 * Format date to short format (e.g., "07 mai")
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString(LOCALE, DATE_FORMAT_OPTIONS.SHORT)
}

/**
 * Format date to numeric short format (e.g., "07/05/26")
 */
export function formatDateNumericShort(date: Date): string {
  return date.toLocaleDateString(LOCALE, DATE_FORMAT_OPTIONS.NUMERIC_SHORT)
}

/**
 * Format date to full format (e.g., "quinta-feira, 7 de maio de 2026")
 */
export function formatDateFull(date: Date): string {
  return date.toLocaleDateString(LOCALE, DATE_FORMAT_OPTIONS.FULL)
}

/**
 * Format date and time to locale string
 */
export function formatDateTime(date: Date): string {
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

// Re-export date utilities from constants
export { getTodayISO, toDateISO }
