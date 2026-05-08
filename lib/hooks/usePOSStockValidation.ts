import { useCallback } from "react"
import type { POSCartItem, POSSale, StockItem, StockMovement } from "../store"
import { generateStockMovementId } from "../utils/id-generators"

/**
 * Hook for POS stock validation and automatic stock decrement
 */
export function usePOSStockValidation() {
  /**
   * Validate that all cart items have sufficient stock
   */
  const validateCartStock = useCallback((
    cart: POSCartItem[],
    stockItems: StockItem[]
  ): { valid: boolean; errors: Array<{ productName: string; message: string }> } => {
    const errors: Array<{ productName: string; message: string }> = []

    for (const item of cart) {
      // Skip products without stock control
      if (!item.product.trackStock) continue

      const stockItem = stockItems.find(s => s.productId === item.product.id)
      
      if (!stockItem) {
        errors.push({
          productName: item.product.name,
          message: `Produto configurado para controle de estoque mas não possui item de estoque cadastrado`,
        })
        continue
      }

      if (stockItem.currentStock < item.quantity) {
        errors.push({
          productName: item.product.name,
          message: `Estoque insuficiente. Disponível: ${stockItem.currentStock} ${stockItem.unit}, necessário: ${item.quantity}`,
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }, [])

  /**
   * Create stock movements for a sale and return updated stock items
   */
  const createStockMovementsForSale = useCallback((
    sale: POSSale,
    stockItems: StockItem[],
    username: string
  ): { movements: StockMovement[]; updatedStockItems: Array<{ id: string; data: Partial<StockItem> }> } => {
    const movements: StockMovement[] = []
    const updatedStockItems: Array<{ id: string; data: Partial<StockItem> }> = []

    for (const item of sale.items) {
      // Skip products without stock control
      if (!item.product.trackStock) continue

      const stockItem = stockItems.find(s => s.productId === item.product.id)
      if (!stockItem) {
        console.warn(`Stock item not found for product ${item.product.id} during sale ${sale.id}`)
        continue
      }

      // Create stock movement
      const movement: StockMovement = {
        id: generateStockMovementId(),
        stockItemId: stockItem.id,
        type: "saida",
        quantity: item.quantity,
        reason: `Venda PDV #${sale.id}`,
        date: sale.date,
        user: username,
        reference: `Venda #${sale.id}`,
        unitCost: stockItem.averageCost,
      }
      movements.push(movement)

      // Calculate new stock
      const newStock = stockItem.currentStock - item.quantity
      updatedStockItems.push({
        id: stockItem.id,
        data: { currentStock: newStock },
      })
    }

    return { movements, updatedStockItems }
  }, [])

  /**
   * Check if any cart item is out of stock
   */
  const hasOutOfStockItems = useCallback((
    cart: POSCartItem[],
    stockItems: StockItem[]
  ): boolean => {
    return cart.some(item => {
      if (!item.product.trackStock) return false
      
      const stockItem = stockItems.find(s => s.productId === item.product.id)
      if (!stockItem) return true
      
      return stockItem.currentStock < item.quantity
    })
  }, [])

  /**
   * Get stock status for a specific product in cart
   */
  const getProductStockStatus = useCallback((
    productId: string,
    quantity: number,
    stockItems: StockItem[]
  ): { available: boolean; currentStock: number; unit: string; message?: string } => {
    const stockItem = stockItems.find(s => s.productId === productId)
    
    if (!stockItem) {
      return {
        available: false,
        currentStock: 0,
        unit: "un",
        message: "Item de estoque não encontrado",
      }
    }

    const available = stockItem.currentStock >= quantity

    return {
      available,
      currentStock: stockItem.currentStock,
      unit: stockItem.unit,
      message: available 
        ? undefined 
        : `Estoque insuficiente (disponível: ${stockItem.currentStock} ${stockItem.unit})`,
    }
  }, [])

  return {
    validateCartStock,
    createStockMovementsForSale,
    hasOutOfStockItems,
    getProductStockStatus,
  }
}
