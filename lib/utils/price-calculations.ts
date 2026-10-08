import { roundMoney } from "./business-values"
/**
 * Centralized price calculation utilities
 * Consolidates pricing logic to ensure consistency across the application
 */

import { LOCALE, CURRENCY_OPTIONS } from "./constants"

export interface CartItem {
  product: {
    price: number
  }
  quantity: number
  discount?: number
}

/**
 * Calculate item total with optional discount
 */
export function calculateItemTotal(price: number, quantity: number, discountPercent: number = 0): number {
  const subtotal = price * quantity
  return roundMoney(subtotal * (1 - discountPercent / 100))
}

/**
 * Calculate cart subtotal (sum of all items before discount)
 */
export function calculateCartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const itemTotal = item.product.price * item.quantity
    const itemDiscount = item.discount || 0
    return roundMoney(sum + roundMoney(itemTotal * (1 - itemDiscount / 100)))
  }, 0)
}

/**
 * Calculate cart total with global discount
 */
export function calculateCartTotal(subtotal: number, discountAmount: number = 0): number {
  return Math.max(0, roundMoney(subtotal - roundMoney(discountAmount)))
}

/**
 * Calculate total from items with optional global discount
 */
export function calculateTotal(items: CartItem[], globalDiscountAmount: number = 0): number {
  const subtotal = calculateCartSubtotal(items)
  return calculateCartTotal(subtotal, globalDiscountAmount)
}

/**
 * Format currency value to BRL with locale formatting
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString(LOCALE, CURRENCY_OPTIONS)
}

/**
 * Format currency value to fixed decimal string (without currency symbol)
 */
export function formatCurrencyFixed(value: number, decimals: number = 2): string {
  return value.toFixed(decimals)
}

/**
 * Format currency value with "R$" prefix and fixed decimals
 * Use this for displaying prices in the UI
 */
export function formatPrice(value: number, decimals: number = 2): string {
  return `R$ ${value.toFixed(decimals)}`
}

/**
 * Format percentage value with fixed decimals
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format percentage change with sign prefix
 */
export function formatPercentageChange(value: number, decimals: number = 1): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}
