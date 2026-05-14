/**
 * Centralized Stock Validation Utilities
 * 
 * This module provides reusable stock validation functions to prevent
 * duplicated validation logic across the application.
 */

import type { StockItem } from "../types"

export interface StockValidationResult {
  isValid: boolean
  error?: {
    title: string
    description: string
    variant: 'destructive' | 'default'
  }
  warning?: {
    title: string
    description: string
    variant: 'default'
  }
}

/**
 * Validates if a product has sufficient stock for a requested quantity
 * 
 * @param stockItem - The stock item to validate
 * @param requestedQuantity - The quantity being requested
 * @param productName - The product name for error messages
 * @returns Validation result with error/warning messages if applicable
 */
export function validateStockAvailability(
  stockItem: StockItem | undefined,
  requestedQuantity: number,
  productName: string
): StockValidationResult {
  // No stock tracking for this product
  if (!stockItem) {
    return { isValid: true }
  }

  // Stock is completely depleted
  if (stockItem.currentStock <= 0) {
    return {
      isValid: false,
      error: {
        title: "Estoque Esgotado",
        description: `${productName} está sem estoque disponível`,
        variant: 'destructive'
      }
    }
  }

  // Requested quantity exceeds available stock
  if (requestedQuantity > stockItem.currentStock) {
    return {
      isValid: false,
      error: {
        title: "Estoque Insuficiente",
        description: `${productName}: apenas ${stockItem.currentStock} ${stockItem.unit} disponível(is)`,
        variant: 'destructive'
      }
    }
  }

  // Warning: requesting the last available item
  if (requestedQuantity === stockItem.currentStock) {
    return {
      isValid: true,
      warning: {
        title: "Último Item",
        description: `Você está usando o último ${productName} disponível em estoque`,
        variant: 'default'
      }
    }
  }

  // All validations passed
  return { isValid: true }
}

/**
 * Checks if a stock item is below minimum threshold
 * 
 * @param stockItem - The stock item to check
 * @returns true if stock is at or below minimum threshold
 */
export function isStockBelowMinimum(stockItem: StockItem): boolean {
  return stockItem.currentStock <= stockItem.minimumStock
}

/**
 * Checks if a stock item is critically low (at or below zero)
 * 
 * @param stockItem - The stock item to check
 * @returns true if stock is critically low
 */
export function isStockCritical(stockItem: StockItem): boolean {
  return stockItem.currentStock <= 0
}

/**
 * Checks if a stock item is approaching minimum (within 50% buffer)
 * 
 * @param stockItem - The stock item to check
 * @returns true if stock is approaching minimum threshold
 */
export function isStockApproachingMinimum(stockItem: StockItem): boolean {
  return stockItem.currentStock <= stockItem.minimumStock * 1.5
}

/**
 * Gets the stock status level for UI display
 * 
 * @param stockItem - The stock item to check
 * @returns Status level: 'critical' | 'low' | 'warning' | 'normal'
 */
export function getStockStatusLevel(
  stockItem: StockItem
): 'critical' | 'low' | 'warning' | 'normal' {
  if (isStockCritical(stockItem)) {
    return 'critical'
  }
  if (isStockBelowMinimum(stockItem)) {
    return 'low'
  }
  if (isStockApproachingMinimum(stockItem)) {
    return 'warning'
  }
  return 'normal'
}
