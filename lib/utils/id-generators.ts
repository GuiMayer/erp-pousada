/**
 * ID generation utilities for consistent entity identification
 */

/**
 * Generates a reservation ID
 * @param count - Current count of reservations
 * @returns Formatted reservation ID (e.g., "R001")
 */
export function generateReservationId(count: number): string {
  return `R${String(count + 1).padStart(3, "0")}`
}

/**
 * Generates a transaction ID based on timestamp
 * @returns Formatted transaction ID (e.g., "T1714989600000")
 */
export function generateTransactionId(): string {
  return `T${Date.now()}`
}

/**
 * Generates an expense ID
 * @param count - Current count of expenses
 * @returns Formatted expense ID (e.g., "E001")
 */
export function generateExpenseId(count: number): string {
  return `E${String(count + 1).padStart(3, "0")}`
}

/**
 * Generates a consumption item ID
 * @returns Unique consumption item ID (e.g., "CI-1714989600000-a1b2")
 */
export function generateConsumptionItemId(): string {
  return `CI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Generates a POS sale ID
 * @param count - Current count of sales
 * @returns Formatted sale ID (e.g., "V001")
 */
export function generateSaleId(count: number): string {
  return `V${String(count + 1).padStart(3, "0")}`
}

/**
 * Generates a POS product ID
 * @param count - Current count of products
 * @returns Formatted product ID (e.g., "P001-1714989600000")
 */
export function generateProductId(count: number): string {
  return `P${String(count + 1).padStart(3, "0")}-${Date.now()}`
}

/**
 * Generates a cash close ID
 * @param count - Current count of cash closes
 * @returns Formatted cash close ID (e.g., "CC001")
 */
export function generateCashCloseId(count: number): string {
  return `CC${String(count + 1).padStart(3, "0")}`
}

/**
 * Generates an audit entry ID
 * @param count - Current count of audit entries
 * @returns Formatted audit entry ID (e.g., "A001")
 */
export function generateAuditId(count: number): string {
  return `A${String(count + 1).padStart(3, "0")}`
}

/**
 * Generates a category ID
 * @param count - Current count of categories
 * @returns Formatted category ID (e.g., "C001")
 */
export function generateCategoryId(count: number): string {
  return `C${String(count + 1).padStart(3, "0")}`
}

/**
 * Generates a cart item ID for POS
 * @returns Unique cart item ID (e.g., "CI-1714989600000-a1b2")
 */
export function generateCartItemId(): string {
  return `CI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}
