/**
 * Validation utilities for state mutations
 */

import type { Room, Reservation, Expense, Transaction, StockItem, Recipe, Employee } from "../store"

/**
 * Validates room data before mutation
 */
export function validateRoom(room: Partial<Room>): { valid: boolean; error?: string } {
  if (room.number !== undefined && room.number <= 0) {
    return { valid: false, error: "Room number must be positive" }
  }
  
  if (room.price !== undefined && room.price < 0) {
    return { valid: false, error: "Room price cannot be negative" }
  }
  
  return { valid: true }
}

/**
 * Validates reservation data before mutation
 */
export function validateReservation(reservation: Partial<Reservation>): { valid: boolean; error?: string } {
  if (reservation.checkIn && reservation.checkOut) {
    const checkIn = new Date(reservation.checkIn)
    const checkOut = new Date(reservation.checkOut)
    
    if (checkOut <= checkIn) {
      return { valid: false, error: "Check-out must be after check-in" }
    }
  }
  
  if (reservation.totalPrice !== undefined && reservation.totalPrice < 0) {
    return { valid: false, error: "Total price cannot be negative" }
  }
  
  return { valid: true }
}

/**
 * Validates expense data before mutation
 */
export function validateExpense(expense: Partial<Expense>): { valid: boolean; error?: string } {
  if (expense.amount !== undefined && expense.amount <= 0) {
    return { valid: false, error: "Expense amount must be positive" }
  }
  
  if (expense.description !== undefined && expense.description.trim() === "") {
    return { valid: false, error: "Expense description cannot be empty" }
  }
  
  return { valid: true }
}

/**
 * Validates transaction data before mutation
 */
export function validateTransaction(transaction: Partial<Transaction>): { valid: boolean; error?: string } {
  if (transaction.amount !== undefined && transaction.amount === 0) {
    return { valid: false, error: "Transaction amount cannot be zero" }
  }
  
  return { valid: true }
}

/**
 * Validates stock item data before mutation
 */
export function validateStockItem(item: Partial<StockItem>): { valid: boolean; error?: string } {
  if (item.quantity !== undefined && item.quantity < 0) {
    return { valid: false, error: "Stock quantity cannot be negative" }
  }
  
  if (item.minQuantity !== undefined && item.minQuantity < 0) {
    return { valid: false, error: "Minimum quantity cannot be negative" }
  }
  
  if (item.unitCost !== undefined && item.unitCost < 0) {
    return { valid: false, error: "Unit cost cannot be negative" }
  }
  
  if (item.name !== undefined && item.name.trim() === "") {
    return { valid: false, error: "Stock item name cannot be empty" }
  }
  
  return { valid: true }
}

/**
 * Validates recipe data before mutation
 */
export function validateRecipe(recipe: Partial<Recipe>): { valid: boolean; error?: string } {
  if (recipe.name !== undefined && recipe.name.trim() === "") {
    return { valid: false, error: "Recipe name cannot be empty" }
  }
  
  if (recipe.yield !== undefined && recipe.yield <= 0) {
    return { valid: false, error: "Recipe yield must be positive" }
  }
  
  if (recipe.ingredients && recipe.ingredients.length === 0) {
    return { valid: false, error: "Recipe must have at least one ingredient" }
  }
  
  if (recipe.ingredients) {
    for (const ingredient of recipe.ingredients) {
      if (ingredient.quantity <= 0) {
        return { valid: false, error: "Ingredient quantities must be positive" }
      }
    }
  }
  
  return { valid: true }
}

/**
 * Validates employee data before mutation
 */
export function validateEmployee(employee: Partial<Employee>): { valid: boolean; error?: string } {
  if (employee.name !== undefined && employee.name.trim() === "") {
    return { valid: false, error: "Employee name cannot be empty" }
  }
  
  if (employee.cpf !== undefined) {
    const cpfClean = employee.cpf.replace(/\D/g, "")
    if (cpfClean.length !== 11) {
      return { valid: false, error: "CPF must have 11 digits" }
    }
  }
  
  return { valid: true }
}

/**
 * Validates CPF format and checksum
 */
export function validateCPF(cpf: string): { valid: boolean; error?: string } {
  const cpfClean = cpf.replace(/\D/g, "")
  
  if (cpfClean.length !== 11) {
    return { valid: false, error: "CPF must have 11 digits" }
  }
  
  // Check for known invalid CPFs (all same digit)
  if (/^(\d)\1{10}$/.test(cpfClean)) {
    return { valid: false, error: "Invalid CPF format" }
  }
  
  // Validate first check digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpfClean.charAt(i)) * (10 - i)
  }
  let checkDigit = 11 - (sum % 11)
  if (checkDigit >= 10) checkDigit = 0
  
  if (checkDigit !== parseInt(cpfClean.charAt(9))) {
    return { valid: false, error: "Invalid CPF checksum" }
  }
  
  // Validate second check digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpfClean.charAt(i)) * (11 - i)
  }
  checkDigit = 11 - (sum % 11)
  if (checkDigit >= 10) checkDigit = 0
  
  if (checkDigit !== parseInt(cpfClean.charAt(10))) {
    return { valid: false, error: "Invalid CPF checksum" }
  }
  
  return { valid: true }
}

/**
 * Helper function that returns boolean for CPF validation
 */
export function isValidCPF(cpf: string): boolean {
  return validateCPF(cpf).valid
}

/**
 * Validates supervisor password using secure server-side authentication
 * @deprecated Use validateSupervisorPasswordAsync instead
 * This function is kept for backward compatibility but always returns false
 * to force migration to the secure API-based authentication
 */
export function validateSupervisorPassword(password: string): boolean {
  console.warn('validateSupervisorPassword is deprecated. Use validateSupervisorPasswordAsync instead.')
  return false
}

/**
 * Validates supervisor password using secure server-side authentication
 * Calls the /api/auth/supervisor endpoint which uses bcrypt hashing
 */
export async function validateSupervisorPasswordAsync(password: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/supervisor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error('Error validating supervisor password:', error)
    return false
  }
}

/**
 * Validates discount value against ceiling
 */
export function validateDiscount(discountValue: number, discountCeiling: number): boolean {
  return discountValue >= 0 && discountValue <= discountCeiling
}

/**
 * Checks if discount requires supervisor approval
 */
export function requiresSupervisorApproval(discountValue: number, discountCeiling: number): boolean {
  return discountValue > discountCeiling
}

/**
 * Validates payment amount is sufficient
 */
export function validatePaymentAmount(amountPaid: number, total: number): boolean {
  return amountPaid >= total
}

/**
 * Validates ISO date string format
 */
export function validateISODate(dateString: string): boolean {
  if (!dateString) return false
  const date = new Date(dateString)
  return !isNaN(date.getTime()) && dateString.includes('-')
}

/**
 * Validates check-out date is after check-in date
 */
export function validateCheckInOutDates(checkIn: string, checkOut: string): boolean {
  const checkInDate = new Date(checkIn)
  const checkOutDate = new Date(checkOut)
  return checkOutDate > checkInDate
}
