import { useCallback } from "react"
import type { POSProduct, StockItem, StockUnit } from "../store"
import { generateStockItemId } from "../utils/id-generators"

/**
 * Hook for managing product-stock integration
 * Handles automatic creation, synchronization, and removal of stock items
 */
export function useProductStockIntegration() {
  /**
   * Create a StockItem for a product with default values
   */
  const createStockItemForProduct = useCallback((product: POSProduct): StockItem => {
    return {
      id: generateStockItemId(),
      productId: product.id,
      productName: product.name,
      currentStock: 0,
      unit: "un" as StockUnit,
      minimumStock: 10,
      maximumStock: 100,
      averageCost: product.price * 0.6, // Estimate 60% of sale price
      lastPurchasePrice: product.price * 0.6,
      lastPurchaseDate: new Date().toISOString().split("T")[0],
    }
  }, [])

  /**
   * Sync product name to all related stock items
   */
  const syncProductNameToStock = useCallback((
    productId: string,
    newName: string,
    stockItems: StockItem[],
    updateStockItem: (id: string, data: Partial<StockItem>) => Promise<void>
  ): Promise<void[]> => {
    const relatedStockItems = stockItems.filter(s => s.productId === productId)
    
    return Promise.all(
      relatedStockItems.map(item => 
        updateStockItem(item.id, { productName: newName })
      )
    )
  }, [])

  /**
   * Check if a product has associated stock items
   */
  const hasStockItem = useCallback((
    productId: string,
    stockItems: StockItem[]
  ): boolean => {
    return stockItems.some(s => s.productId === productId)
  }, [])

  /**
   * Get all stock items for a product
   */
  const getStockItemsForProduct = useCallback((
    productId: string,
    stockItems: StockItem[]
  ): StockItem[] => {
    return stockItems.filter(s => s.productId === productId)
  }, [])

  /**
   * Find products with trackStock enabled but no stock item
   */
  const findProductsWithoutStock = useCallback((
    products: POSProduct[],
    stockItems: StockItem[]
  ): POSProduct[] => {
    return products.filter(p => 
      p.trackStock && !stockItems.some(s => s.productId === p.id)
    )
  }, [])

  /**
   * Find stock items without associated products (orphaned)
   */
  const findOrphanStockItems = useCallback((
    products: POSProduct[],
    stockItems: StockItem[]
  ): StockItem[] => {
    return stockItems.filter(s => 
      !products.some(p => p.id === s.productId)
    )
  }, [])

  /**
   * Validate product-stock consistency
   */
  const validateProductStockConsistency = useCallback((
    products: POSProduct[],
    stockItems: StockItem[]
  ): {
    valid: boolean
    issues: {
      productsWithoutStock: POSProduct[]
      orphanedStockItems: StockItem[]
      nameMismatches: Array<{ product: POSProduct; stockItem: StockItem }>
    }
  } => {
    const productsWithoutStock = findProductsWithoutStock(products, stockItems)
    const orphanedStockItems = findOrphanStockItems(products, stockItems)
    
    // Find name mismatches
    const nameMismatches: Array<{ product: POSProduct; stockItem: StockItem }> = []
    for (const product of products) {
      const stockItem = stockItems.find(s => s.productId === product.id)
      if (stockItem && stockItem.productName !== product.name) {
        nameMismatches.push({ product, stockItem })
      }
    }

    return {
      valid: productsWithoutStock.length === 0 && 
             orphanedStockItems.length === 0 && 
             nameMismatches.length === 0,
      issues: {
        productsWithoutStock,
        orphanedStockItems,
        nameMismatches,
      },
    }
  }, [findProductsWithoutStock, findOrphanStockItems])

  return {
    createStockItemForProduct,
    syncProductNameToStock,
    hasStockItem,
    getStockItemsForProduct,
    findProductsWithoutStock,
    findOrphanStockItems,
    validateProductStockConsistency,
  }
}
