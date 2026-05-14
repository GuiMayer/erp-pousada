import { useCallback } from "react"
import { useApp } from "../app-context"
import { useAlerts } from "../alert-context"
import type { POSCartItem, RecipeIngredient, StockMovement } from "../store"
import { generateStockMovementId } from "../utils/id-generators"

/**
 * Hook for integrating stock management with sales and production
 * 
 * Provides automatic stock deduction for sales and production operations
 * with rollback capability in case of errors
 */
export function useStockIntegration() {
  const {
    stockItems,
    stockMovements,
    posProducts,
    addStockMovement,
    updateStockItem,
  } = useApp()
  const { addAlert } = useAlerts()

  /**
   * Process stock deduction for a sale
   * Returns movement IDs for rollback if needed
   */
  const processStockForSale = useCallback(async (
    saleItems: POSCartItem[],
    registeredBy: string
  ): Promise<{ success: boolean; error?: string; movementIds?: string[] }> => {
    const movementIds: string[] = []
    const itemsToProcess: Array<{ productId: string; quantity: number; productName: string }> = []

    // First, validate all items have sufficient stock
    for (const item of saleItems) {
      const product = posProducts.find(p => p.id === item.product.id)
      if (!product) {
        return { success: false, error: `Produto ${item.product.name} não encontrado` }
      }

      // Only check stock for products with stock control enabled
      if (!product.stockControl) continue

      const stockItem = stockItems.find(s => s.productId === product.id)
      if (!stockItem) {
        return { 
          success: false, 
          error: `Produto ${product.name} não tem controle de estoque configurado` 
        }
      }

      if (stockItem.currentStock < item.quantity) {
        return {
          success: false,
          error: `Estoque insuficiente para ${product.name}. Disponível: ${stockItem.currentStock} ${stockItem.unit}`
        }
      }

      itemsToProcess.push({
        productId: product.id,
        quantity: item.quantity,
        productName: product.name,
      })
    }

    // If validation passed, process all movements
    try {
      for (const item of itemsToProcess) {
        const stockItem = stockItems.find(s => s.productId === item.productId)
        if (!stockItem) continue

        const movementId = generateStockMovementId()
        movementIds.push(movementId)

        // Create movement record
        await addStockMovement({
          id: movementId,
          type: 'saida',
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unit: stockItem.unit,
          reason: 'Venda no PDV',
          timestamp: new Date().toISOString(),
          registeredBy,
        })

        // Update stock
        const newStock = Math.max(0, stockItem.currentStock - item.quantity)
        await updateStockItem(stockItem.id, { currentStock: newStock })

        // Check if stock is now low and alert
        if (newStock <= stockItem.minimumStock) {
          addAlert({
            type: 'warning',
            priority: newStock === 0 ? 'critical' : 'high',
            title: 'Estoque Baixo Após Venda',
            message: `${item.productName}: ${newStock} ${stockItem.unit} restante (mínimo: ${stockItem.minimumStock})`,
          })
        }
      }

      return { success: true, movementIds }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.error('Failed to process stock for sale:', error)
      
      // Attempt rollback
      await rollbackStock(movementIds, registeredBy)
      
      return { success: false, error: `Erro ao processar estoque: ${errorMessage}` }
    }
  }, [stockItems, posProducts, addStockMovement, updateStockItem, addAlert])

  /**
   * Process stock deduction for production (recipe ingredients)
   */
  const processStockForProduction = useCallback(async (
    ingredients: RecipeIngredient[],
    recipeName: string,
    registeredBy: string
  ): Promise<{ success: boolean; error?: string; movementIds?: string[] }> => {
    const movementIds: string[] = []

    // First, validate all ingredients have sufficient stock
    for (const ingredient of ingredients) {
      const stockItem = stockItems.find(s => s.productId === ingredient.productId)
      if (!stockItem) {
        return {
          success: false,
          error: `Ingrediente ${ingredient.productName} não tem controle de estoque`
        }
      }

      if (stockItem.currentStock < ingredient.quantity) {
        return {
          success: false,
          error: `Estoque insuficiente de ${ingredient.productName}. Disponível: ${stockItem.currentStock} ${stockItem.unit}`
        }
      }
    }

    // If validation passed, process all movements
    try {
      for (const ingredient of ingredients) {
        const stockItem = stockItems.find(s => s.productId === ingredient.productId)
        if (!stockItem) continue

        const movementId = generateStockMovementId()
        movementIds.push(movementId)

        // Create movement record
        await addStockMovement({
          id: movementId,
          type: 'saida',
          productId: ingredient.productId,
          productName: ingredient.productName,
          quantity: ingredient.quantity,
          unit: stockItem.unit,
          cost: ingredient.cost,
          reason: `Produção: ${recipeName}`,
          timestamp: new Date().toISOString(),
          registeredBy,
        })

        // Update stock
        const newStock = Math.max(0, stockItem.currentStock - ingredient.quantity)
        await updateStockItem(stockItem.id, { currentStock: newStock })

        // Check if stock is now low and alert
        if (newStock <= stockItem.minimumStock) {
          addAlert({
            type: 'warning',
            priority: newStock === 0 ? 'critical' : 'high',
            title: 'Estoque Baixo Após Produção',
            message: `${ingredient.productName}: ${newStock} ${stockItem.unit} restante (mínimo: ${stockItem.minimumStock})`,
          })
        }
      }

      return { success: true, movementIds }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.error('Failed to process stock for production:', error)
      
      // Attempt rollback
      await rollbackStock(movementIds, registeredBy)
      
      return { success: false, error: `Erro ao processar estoque: ${errorMessage}` }
    }
  }, [stockItems, addStockMovement, updateStockItem, addAlert])

  /**
   * Rollback stock movements (compensating transaction)
   * Creates reverse movements to undo previous deductions
   * 
   * IMPLEMENTATION: This function now properly implements rollback by:
   * 1. Fetching the original movements by their IDs
   * 2. Creating compensating "entrada" movements for each "saida"
   * 3. Restoring the stock quantities to their previous state
   */
  const rollbackStock = useCallback(async (
    movementIds: string[],
    registeredBy: string
  ): Promise<void> => {
    if (movementIds.length === 0) {
      console.warn('Rollback called with no movement IDs')
      return
    }

    const rolledBackMovements: string[] = []
    const failedRollbacks: string[] = []

    try {
      console.warn('Stock rollback initiated for movements:', movementIds)
      
      // Fetch the original movements
      const originalMovements = stockMovements.filter(m => movementIds.includes(m.id))
      
      if (originalMovements.length === 0) {
        console.error('No movements found for rollback IDs:', movementIds)
        addAlert({
          type: 'error',
          priority: 'critical',
          title: 'Falha no Rollback de Estoque',
          message: 'Movimentos originais não encontrados. Verifique o estoque manualmente!',
        })
        return
      }

      // Process each movement in reverse
      for (const originalMovement of originalMovements) {
        try {
          // Only rollback "saida" movements
          if (originalMovement.type !== 'saida') {
            console.warn(`Skipping rollback for non-saida movement: ${originalMovement.id}`)
            continue
          }

          const stockItem = stockItems.find(s => s.productId === originalMovement.productId)
          if (!stockItem) {
            console.error(`Stock item not found for product: ${originalMovement.productId}`)
            failedRollbacks.push(originalMovement.productName)
            continue
          }

          // Create compensating "entrada" movement
          const compensatingMovementId = generateStockMovementId()
          await addStockMovement({
            id: compensatingMovementId,
            type: 'entrada',
            productId: originalMovement.productId,
            productName: originalMovement.productName,
            quantity: originalMovement.quantity,
            unit: originalMovement.unit,
            cost: originalMovement.cost,
            reason: `Rollback: ${originalMovement.reason}`,
            notes: `Compensação automática do movimento ${originalMovement.id}`,
            timestamp: new Date().toISOString(),
            registeredBy,
          })

          // Restore stock quantity
          const restoredStock = stockItem.currentStock + originalMovement.quantity
          await updateStockItem(stockItem.id, { currentStock: restoredStock })

          rolledBackMovements.push(originalMovement.productName)
          console.log(`Rolled back movement ${originalMovement.id}: restored ${originalMovement.quantity} ${originalMovement.unit} of ${originalMovement.productName}`)
        } catch (error) {
          console.error(`Failed to rollback movement ${originalMovement.id}:`, error)
          failedRollbacks.push(originalMovement.productName)
        }
      }

      // Report results
      if (failedRollbacks.length === 0) {
        addAlert({
          type: 'warning',
          priority: 'high',
          title: 'Estoque Revertido com Sucesso',
          message: `Rollback concluído: ${rolledBackMovements.length} item(ns) restaurado(s).`,
        })
        console.log('Stock rollback completed successfully:', rolledBackMovements)
      } else {
        addAlert({
          type: 'error',
          priority: 'critical',
          title: 'Rollback Parcialmente Concluído',
          message: `${rolledBackMovements.length} item(ns) revertido(s), ${failedRollbacks.length} falhou(aram). Verifique: ${failedRollbacks.join(', ')}`,
        })
        console.error('Stock rollback partially failed:', { rolledBackMovements, failedRollbacks })
      }
    } catch (error) {
      console.error('Critical failure during stock rollback:', error)
      addAlert({
        type: 'error',
        priority: 'critical',
        title: 'Falha Crítica no Rollback de Estoque',
        message: 'ATENÇÃO: Verifique o estoque imediatamente! Rollback não pôde ser concluído.',
      })
    }
  }, [stockMovements, stockItems, addStockMovement, updateStockItem, addAlert])

  /**
   * Validate stock availability for cart items
   */
  const validateStockAvailability = useCallback((
    cartItems: POSCartItem[]
  ): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    for (const item of cartItems) {
      const product = posProducts.find(p => p.id === item.product.id)
      if (!product || !product.stockControl) continue

      const stockItem = stockItems.find(s => s.productId === product.id)
      if (!stockItem) {
        errors.push(`${product.name}: sem controle de estoque`)
        continue
      }

      if (stockItem.currentStock < item.quantity) {
        errors.push(
          `${product.name}: estoque insuficiente (disponível: ${stockItem.currentStock} ${stockItem.unit})`
        )
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }, [stockItems, posProducts])

  return {
    processStockForSale,
    processStockForProduction,
    rollbackStock,
    validateStockAvailability,
  }
}
