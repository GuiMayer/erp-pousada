import { useState, useCallback, useMemo } from "react"
import { useApp } from "../app-context"
import type { StockItem, StockMovement, MovementType, StockUnit } from "../store"

/**
 * Hook for managing stock control
 * Provides utilities for tracking inventory, movements, and alerts
 */
export function useStockControl() {
  const {
    stockItems,
    stockMovements,
    addStockItem,
    updateStockItem,
    addStockMovement,
    posProducts,
  } = useApp()

  const [filter, setFilter] = useState<"all" | "critical" | "low" | "ok">("all")

  // Get stock status for an item
  const getStockStatus = useCallback((item: StockItem): "critical" | "low" | "ok" => {
    if (item.currentStock <= 0) return "critical"
    if (item.currentStock <= item.minimumStock) return "critical"
    if (item.currentStock <= item.minimumStock * 1.5) return "low"
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
    return item.currentStock >= quantity
  }, [stockItems])

  // Get stock item by product ID
  const getStockByProduct = useCallback((productId: string) => {
    return stockItems.find(s => s.productId === productId)
  }, [stockItems])

  // Register stock movement
  const registerMovement = useCallback((
    type: MovementType,
    productId: string,
    quantity: number,
    reason: string,
    registeredBy: string,
    cost?: number,
    invoiceNumber?: string,
    expirationDate?: string,
    notes?: string
  ) => {
    const product = posProducts.find(p => p.id === productId)
    if (!product) return

    const movement: StockMovement = {
      id: `SM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      productId,
      productName: product.name,
      quantity,
      unit: getStockByProduct(productId)?.unit || "un",
      cost,
      reason,
      timestamp: new Date().toISOString(),
      registeredBy,
      invoiceNumber,
      expirationDate,
      notes,
    }

    addStockMovement(movement)

    // Update stock item
    const stockItem = getStockByProduct(productId)
    if (stockItem) {
      let newStock = stockItem.currentStock

      if (type === "entrada") {
        newStock += quantity
        // Update average cost if cost is provided
        if (cost) {
          const totalValue = (stockItem.currentStock * stockItem.averageCost) + (quantity * cost)
          const newAverageCost = totalValue / newStock
          updateStockItem(stockItem.id, {
            currentStock: newStock,
            averageCost: newAverageCost,
            lastPurchasePrice: cost,
            lastPurchaseDate: new Date().toISOString().split("T")[0],
          })
        } else {
          updateStockItem(stockItem.id, { currentStock: newStock })
        }
      } else if (type === "saida" || type === "perda") {
        newStock = Math.max(0, newStock - quantity)
        updateStockItem(stockItem.id, { currentStock: newStock })
      } else if (type === "ajuste") {
        updateStockItem(stockItem.id, { currentStock: quantity })
      }
    }
  }, [posProducts, stockItems, addStockMovement, updateStockItem, getStockByProduct])

  // Get movements by product
  const getMovementsByProduct = useCallback((productId: string) => {
    return stockMovements
      .filter(m => m.productId === productId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [stockMovements])

  // Get recent movements
  const getRecentMovements = useCallback((limit: number = 10) => {
    return stockMovements
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }, [stockMovements])

  // Validate stock movement
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
