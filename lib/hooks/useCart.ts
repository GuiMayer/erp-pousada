import { useState, useCallback } from "react"
import type { POSCartItem, POSProduct, StockItem } from "../store"
import { generateCartItemId } from "../utils/id-generators"

/**
 * Hook for managing shopping cart state and operations
 * Now includes stock validation
 */
export function useCart(stockItems?: StockItem[]) {
  const [cart, setCart] = useState<POSCartItem[]>([])

  const addToCart = useCallback((product: POSProduct, quantity: number = 1) => {
    // Validate stock if product has stock control enabled
    if (product.trackStock && stockItems) {
      const stockItem = stockItems.find(s => s.productId === product.id)
      if (stockItem) {
        const currentInCart = cart.find(item => item.product.id === product.id)?.quantity || 0
        const totalNeeded = currentInCart + quantity
        
        if (stockItem.currentStock < totalNeeded) {
          // Return error - caller should handle this
          throw new Error(
            `Estoque insuficiente para ${product.name}. Disponível: ${stockItem.currentStock} ${stockItem.unit}`
          )
        }
      }
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, {
        id: generateCartItemId(),
        product,
        quantity,
        discount: 0,
      }]
    })
  }, [stockItems, cart])

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId))
  }, [])

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) return

    // Validate stock if product has stock control enabled
    const cartItem = cart.find(item => item.id === itemId)
    if (cartItem && cartItem.product.trackStock && stockItems) {
      const stockItem = stockItems.find(s => s.productId === cartItem.product.id)
      if (stockItem && stockItem.currentStock < quantity) {
        throw new Error(
          `Estoque insuficiente para ${cartItem.product.name}. Disponível: ${stockItem.currentStock} ${stockItem.unit}`
        )
      }
    }

    setCart(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity } : item
    ))
  }, [stockItems, cart])

  const updateItemDiscount = useCallback((itemId: string, discount: number) => {
    setCart(prev => prev.map(item =>
      item.id === itemId ? { ...item, discount } : item
    ))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const getItemTotal = useCallback((item: POSCartItem) => {
    const subtotal = item.product.price * item.quantity
    return subtotal - (subtotal * item.discount / 100)
  }, [])

  const subtotal = cart.reduce((sum, item) => 
    sum + (item.product.price * item.quantity), 0
  )

  const totalDiscount = cart.reduce((sum, item) => 
    sum + (item.product.price * item.quantity * item.discount / 100), 0
  )

  const total = subtotal - totalDiscount

  /**
   * Validate stock availability for all items in cart
   */
  const validateStockAvailability = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!stockItems) {
      return { valid: true, errors: [] }
    }

    for (const item of cart) {
      if (!item.product.trackStock) continue

      const stockItem = stockItems.find(s => s.productId === item.product.id)
      if (!stockItem) {
        errors.push(`${item.product.name}: sem controle de estoque`)
        continue
      }

      if (stockItem.currentStock < item.quantity) {
        errors.push(
          `${item.product.name}: estoque insuficiente (disponível: ${stockItem.currentStock} ${stockItem.unit})`
        )
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }, [cart, stockItems])

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemDiscount,
    clearCart,
    getItemTotal,
    validateStockAvailability,
    subtotal,
    totalDiscount,
    total,
    itemCount: cart.length,
  }
}
