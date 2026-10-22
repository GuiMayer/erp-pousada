import { businessDay } from "./business-values"
/**
 * Formatting utilities for currency, dates, and other display values
 */

/**
 * Formats a number as Brazilian currency (BRL)
 * @param value - The numeric value to format
 * @returns Formatted currency string (e.g., "R$ 1.234,56")
 */
const numberFormats = new Map<string, Intl.NumberFormat>()
export function formatNumber(value: number | null | undefined, decimals = 2, useGrouping = true): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const key = `${decimals}:${useGrouping}`
  let formatter = numberFormats.get(key)
  if (!formatter) { formatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping }); numberFormats.set(key, formatter) }
  return formatter.format(value)
}
export function formatCurrency(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—"
  return `${value < 0 ? "-" : ""}R$ ${formatNumber(Math.abs(value), decimals)}`
}
export function formatPercent(value: number, decimals = 1): string {
  return Number.isFinite(value) ? `${formatNumber(value, decimals)}%` : "—"
}

/**
 * Formats an ISO date string to Brazilian short date format
 * @param iso - ISO date string (e.g., "2026-05-07" or "2026-05-07T10:30:00")
 * @returns Formatted date string (e.g., "07/05/26")
 */
export function formatDateBR(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00")
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

/**
 * Formats an ISO date string to Brazilian date and time format
 * @param iso - ISO date string with time
 * @returns Formatted date and time string (e.g., "07/05/2026 10:30")
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Formats an ISO date string to a short date label
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
 * Gets an ISO date string for a date offset from today
 * @param offset - Number of days from today (0 = today, 1 = tomorrow, etc.)
 * @returns ISO date string (e.g., "2026-05-07")
 */
export function getDateISO(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().split("T")[0]
}

/**
 * Calculates days until a due date
 * @param iso - ISO date string of the due date
 * @returns Number of days until due (negative if overdue)
 */
export function daysUntilDue(iso: string): number {
  return Math.round((new Date(businessDay(iso)).getTime() - new Date(businessDay()).getTime()) / 86400000)
}
