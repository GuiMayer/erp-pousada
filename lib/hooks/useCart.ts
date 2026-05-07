import { useState, useCallback } from "react"
import type { POSCartItem, POSProduct } from "../store"
import { generateCartItemId } from "../utils/id-generators"

/**
 * Hook for managing shopping cart state and operations
 */
export function useCart() {
  const [cart, setCart] = useState<POSCartItem[]>([])

  const addToCart = useCallback((product: POSProduct, quantity: number = 1) => {
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
  }, [])

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId))
  }, [])

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) return
    setCart(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity } : item
    ))
  }, [])

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

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemDiscount,
    clearCart,
    getItemTotal,
    subtotal,
    totalDiscount,
    total,
    itemCount: cart.length,
  }
}
