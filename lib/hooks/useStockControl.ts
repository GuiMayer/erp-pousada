import { pousadaStock } from "@/lib/pousada-scope"
import { getDataConfig } from "../data/config"
import { useState, useCallback, useMemo } from "react"
import { useApp } from "../app-context"
import type { StockItem, StockMovement, MovementType, StockUnit } from "../store"
import { generateStockMovementId } from "../utils/id-generators"

/**
 * Hook for managing stock control
 * Provides utilities for tracking inventory, movements, and alerts
 */
export function useStockControl({ includeArchived = false }: { includeArchived?: boolean } = {}) {
  const {
    runOperation, stockItems: allStockItems,
    stockMovements,
    addStockItem,
    updateStockItem,
    addStockMovement,
    posProducts, productCategories,
  } = useApp()

  const stockItems = useMemo(() => includeArchived ? allStockItems : pousadaStock(allStockItems, posProducts, productCategories), [includeArchived, allStockItems, posProducts, productCategories])
  const [filter, setFilter] = useState<"all" | "critical" | "low" | "ok">("all")

  // Get stock status for an item
  const getStockStatus = useCallback((item: StockItem): "critical" | "low" | "ok" => {
    if ((item.usableStock ?? item.currentStock) <= 0) return "critical"
    if ((item.usableStock ?? item.currentStock) <= item.minimumStock) return "critical"
    if ((item.usableStock ?? item.currentStock) <= item.minimumStock * 1.5) return "low"
    return "ok"
  }, [])

  // Filter stock items by status
  const filteredItems = useMemo(() => {
    if (filter === "all") return stockItems

    return stockItems.filter(item => {
      const status = getStockStatus(item)
      return status === filter
    })
  }, [stockItems, filter, getStockStatus])

  // Get stock statistics
  const stats = useMemo(() => {
    const total = stockItems.length
    const critical = stockItems.filter(item => getStockStatus(item) === "critical").length
    const low = stockItems.filter(item => getStockStatus(item) === "low").length
    const ok = stockItems.filter(item => getStockStatus(item) === "ok").length

    return { total, critical, low, ok }
  }, [stockItems, getStockStatus])

  // Check if product has sufficient stock
  const hasStock = useCallback((productId: string, quantity: number): boolean => {
    const item = stockItems.find(s => s.productId === productId)
    if (!item) return false
    return (item.usableStock ?? item.currentStock) >= quantity
  }, [stockItems])

  // Get stock item by product ID
  const getStockByProduct = useCallback((productId: string) => {
    return stockItems.find(s => s.productId === productId)
  }, [stockItems])

  const validateMovement = useCallback((
    type: MovementType,
    productId: string,
    quantity: number
  ): { valid: boolean; error?: string } => {
    if (quantity <= 0) {
      return { valid: false, error: "Quantidade deve ser maior que zero" }
    }

    const stockItem = getStockByProduct(productId)
    if (!stockItem) {
      return { valid: false, error: "Produto não encontrado no estoque" }
    }

    if (type === "saida" || type === "perda") {
      if (stockItem.currentStock < quantity) {
        return {
          valid: false,
          error: `Estoque insuficiente. Disponível: ${stockItem.currentStock} ${stockItem.unit}`,
        }
      }
    }

    return { valid: true }
  }, [getStockByProduct])

  // Register stock movement
  const registerMovement = useCallback(async (
    type: MovementType,
    productId: string,
    quantity: number,
    reason: string,
    registeredBy: string,
    cost?: number,
    invoiceNumber?: string,
    expirationDate?: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Validate movement before processing
    const validation = validateMovement(type, productId, quantity)
    if (!validation.valid) {
      console.error(`Stock movement validation failed: ${validation.error}`)
      return { success: false, error: validation.error }
    }

    const product = posProducts.find(p => p.id === productId)
    if (!product) {
      const error = "Produto não encontrado"
      console.error(`Stock movement failed: ${error}`)
      return { success: false, error }
    }

    const stockItem = getStockByProduct(productId)
    if (!stockItem) {
      const error = "Item de estoque não encontrado"
      console.error(`Stock movement failed: ${error}`)
      return { success: false, error }
    }

    // Validate cost for entrada movements
    if (type === "entrada" && cost !== undefined && cost < 0) {
      const error = "Custo não pode ser negativo"
      console.error(`Stock movement failed: ${error}`)
      return { success: false, error }
    }

    try {
      if (getDataConfig().adapter === "database") {
        await runOperation("stock-movement", { type, productId, quantity, reason, cost, invoiceNumber, expirationDate, notes })
        return { success: true }
      }
      const movement: StockMovement = {
        id: generateStockMovementId(),
        type,
        productId,
        productName: product.name,
        quantity,
        unit: stockItem.unit,
        cost,
        reason,
        timestamp: new Date().toISOString(),
        registeredBy,
        invoiceNumber,
        expirationDate,
        notes,
      }

      await addStockMovement(movement)

      // Update stock item
      let newStock = stockItem.currentStock

      if (type === "entrada") {
        newStock += quantity
        // Update average cost if cost is provided
        if (cost) {
          const totalValue = (stockItem.currentStock * stockItem.averageCost) + (quantity * cost)
          const newAverageCost = totalValue / newStock
          await updateStockItem(stockItem.id, {
            currentStock: newStock,
            averageCost: newAverageCost,
            lastPurchasePrice: cost,
            lastPurchaseDate: new Date().toISOString().split("T")[0],
          })
        } else {
          await updateStockItem(stockItem.id, { currentStock: newStock })
        }
      } else if (type === "saida" || type === "perda") {
        newStock = Math.max(0, newStock - quantity)
        await updateStockItem(stockItem.id, { currentStock: newStock })
      } else if (type === "ajuste") {
        await updateStockItem(stockItem.id, { currentStock: quantity })
      }

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao registrar movimento"
      console.error(`Stock movement failed: ${errorMessage}`, error)
      return { success: false, error: errorMessage }
    }
  }, [runOperation, validateMovement, posProducts, addStockMovement, updateStockItem, getStockByProduct])

  // Get movements by product
  const getMovementsByProduct = useCallback((productId: string) => {
    return stockMovements
      .filter(m => m.productId === productId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [stockMovements])

  // Get recent movements
  const getRecentMovements = useCallback((limit: number = 10) => {
    return [...stockMovements]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }, [stockMovements])

  // Validate stock movement


  return {
    stockItems: filteredItems,
    allStockItems: stockItems,
    stockMovements,
    filter,
    setFilter,
    stats,
    getStockStatus,
    hasStock,
    getStockByProduct,
    registerMovement,
    getMovementsByProduct,
    getRecentMovements,
    validateMovement,
  }
}
