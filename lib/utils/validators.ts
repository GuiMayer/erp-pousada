/**
 * Validation utilities for business rules and data integrity
 */

import { SUPERVISOR_PASSWORD } from "../constants"

/**
 * Validates supervisor password
 * @param password - Password to validate
 * @returns True if password is correct
 */
export function validateSupervisorPassword(password: string): boolean {
  return password === SUPERVISOR_PASSWORD
}

/**
 * Validates Brazilian CPF format (basic format check)
 * @param cpf - CPF string to validate
 * @returns True if CPF has valid format
 */
export function validateCPF(cpf: string): boolean {
  // Remove non-numeric characters
  const cleaned = cpf.replace(/\D/g, "")
  
  // Check if has 11 digits
  if (cleaned.length !== 11) return false
  
  // Check if all digits are the same (invalid CPF)
  if (/^(\d)\1{10}$/.test(cleaned)) return false
  
  return true
}

/**
 * Validates if a discount value is within allowed ceiling
 * @param value - Discount value (percentage)
 * @param ceiling - Maximum allowed discount
 * @returns True if discount is within ceiling
 */
export function validateDiscount(value: number, ceiling: number): boolean {
  return value >= 0 && value <= ceiling
}

/**
 * Validates if a discount requires supervisor approval
 * @param value - Discount value (percentage)
 * @param ceiling - Maximum allowed discount without approval
 * @returns True if supervisor approval is required
 */
export function requiresSupervisorApproval(value: number, ceiling: number): boolean {
  return value > ceiling
}

/**
 * Validates if a payment amount is sufficient for a transaction
 * @param amountPaid - Amount paid by customer
 * @param total - Total amount due
 * @returns True if payment is sufficient
 */
export function validatePaymentAmount(amountPaid: number, total: number): boolean {
  return amountPaid >= total
}

/**
 * Validates if a date string is in valid ISO format
 * @param dateString - Date string to validate
 * @returns True if date is valid
 */
export function validateISODate(dateString: string): boolean {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

/**
 * Validates if checkout date is after checkin date
 * @param checkIn - Check-in date (ISO string)
 * @param checkOut - Check-out date (ISO string)
 * @returns True if dates are valid
 */
export function validateCheckInOutDates(checkIn: string, checkOut: string): boolean {
  const checkInDate = new Date(checkIn)
  const checkOutDate = new Date(checkOut)
  return checkOutDate > checkInDate
}
