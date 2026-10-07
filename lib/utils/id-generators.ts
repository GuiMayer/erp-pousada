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
 * Generates an expense installment ID
 * @returns Unique installment ID (e.g., "EI-1714989600000-a1b2")
 */
export function generateExpenseInstallmentId(): string {
  return `EI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
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
 * Generates a supplier ID
 * @param count - Current count of suppliers
 * @returns Formatted supplier ID (e.g., "SUP0001")
 */
export function generateSupplierId(count: number): string {
  return `SUP${String(count + 1).padStart(4, "0")}`
}

/**
 * Generates a customer ID
 * @param count - Current count of customers
 * @returns Formatted customer ID (e.g., "CLI0001")
 */
export function generateCustomerId(count: number): string {
  return `CLI${String(count + 1).padStart(4, "0")}`
}

/**
 * Generates an account receivable ID
 * @param count - Current count of accounts receivable
 * @returns Formatted account receivable ID (e.g., "AR0001")
 */
export function generateAccountReceivableId(count: number): string {
  return `AR${String(count + 1).padStart(4, "0")}`
}

/**
 * Generates a bank account ID
 * @param count - Current count of bank accounts
 * @returns Formatted bank account ID (e.g., "BA001")
 */
export function generateBankAccountId(count: number): string {
  return `BA${String(count + 1).padStart(3, "0")}`
}

/**
 * Generates a cost center ID
 * @param count - Current count of cost centers
 * @returns Formatted cost center ID (e.g., "CC001")
 */
export function generateCostCenterId(count: number): string {
  return `CC${String(count + 1).padStart(3, "0")}`
}

/**
 * Generates a budget ID
 * @param count - Current count of budgets
 * @returns Formatted budget ID (e.g., "BUD001")
 */
export function generateBudgetId(count: number): string {
  return `BUD${String(count + 1).padStart(3, "0")}`
}

/**
 * Generates a recurring transaction ID
 * @param count - Current count of recurring transactions
 * @returns Formatted recurring transaction ID (e.g., "REC0001")
 */
export function generateRecurringTransactionId(count: number): string {
  return `REC${String(count + 1).padStart(4, "0")}`
}

/**
 * Generates a cart item ID for POS
 * @returns Unique cart item ID (e.g., "CI-1714989600000-a1b2")
 */
export function generateCartItemId(): string {
  return `CI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Generates a stock movement ID
 * @returns Unique stock movement ID (e.g., "SM-1714989600000-a1b2c3d4")
 */
export function generateStockMovementId(): string {
  return `SM-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Generates a restaurant order ID
 * @returns Unique order ID (e.g., "ORD-1714989600000-a1b2c3d4")
 */
export function generateOrderId(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Generates a restaurant order item ID
 * @returns Unique order item ID (e.g., "OI-1714989600000-a1b2c3d4")
 */
export function generateOrderItemId(): string {
  return `OI-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Generates a recipe ID
 * @returns Unique recipe ID (e.g., "REC-1714989600000-a1b2")
 */
export function generateRecipeId(): string {
  return `REC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Generates a production ID
 * @returns Unique production ID (e.g., "PROD-1714989600000-a1b2c3d4")
 */
export function generateProductionId(): string {
  return `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function generateStockItemId() { return `stock-${crypto.randomUUID()}` }
