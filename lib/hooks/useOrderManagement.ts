import { useState, useCallback, useMemo } from "react"
import { useApp } from "../app-context"
import type { RestaurantOrder, RestaurantOrderItem, POSProduct } from "../store"
import { generateOrderItemId } from "../utils/id-generators"

/**
 * Hook for managing restaurant orders (comandas)
 * Provides utilities for creating, updating, and managing order items
 */
export function useOrderManagement(orderId?: string) {
  const {
    restaurantOrders,
    addRestaurantOrder,
    updateRestaurantOrder,
    addOrderItem,
    removeOrderItem,
    posProducts,
    getCategoryName,
  } = useApp()

  const [discount, setDiscount] = useState(0)

  // Get current order
  const order = useMemo(() => {
    if (!orderId) return null
    return restaurantOrders.find(o => o.id === orderId) || null
  }, [restaurantOrders, orderId])

  // Calculate order totals
  const totals = useMemo(() => {
    if (!order) return { subtotal: 0, discount: 0, total: 0 }

    const subtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0)
    const discountAmount = (subtotal * discount) / 100
    const total = subtotal - discountAmount

    return { subtotal, discount: discountAmount, total }
  }, [order, discount])

  // Add item to order
  const addItem = useCallback((product: POSProduct, quantity: number = 1) => {
    if (!orderId) return

    const item: RestaurantOrderItem = {
      id: generateOrderItemId(),
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: product.price,
      subtotal: product.price * quantity,
      category: getCategoryName(product.categoryId),
    }

    addOrderItem(orderId, item)
  }, [orderId, addOrderItem, getCategoryName])

  // Remove item from order
  const removeItem = useCallback((itemId: string) => {
    if (!orderId) return
    removeOrderItem(orderId, itemId)
  }, [orderId, removeOrderItem])

  // Update item quantity
  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    if (!order) return

    const updatedItems = order.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity,
          subtotal: item.unitPrice * quantity,
        }
      }
      return item
    })

    updateRestaurantOrder(orderId!, { items: updatedItems })
  }, [order, orderId, updateRestaurantOrder])

  // Apply discount to order
  const applyDiscount = useCallback((discountPercent: number) => {
    setDiscount(discountPercent)
    if (orderId) {
      updateRestaurantOrder(orderId, { discount: (totals.subtotal * discountPercent) / 100 })
    }
  }, [orderId, totals.subtotal, updateRestaurantOrder])

  // Close order (finalize payment)
  const closeOrder = useCallback((paymentMethod: string, amountPaid: number, customer?: string) => {
    if (!orderId) return

    const change = amountPaid - totals.total

    updateRestaurantOrder(orderId, {
      status: "fechada",
      closedAt: new Date().toISOString(),
      paymentMethod,
      amountPaid,
      change,
      customer,
      total: totals.total,
      subtotal: totals.subtotal,
      discount: totals.discount,
    })
  }, [orderId, totals, updateRestaurantOrder])

  // Cancel order
  const cancelOrder = useCallback((reason: string) => {
    if (!orderId) return

    updateRestaurantOrder(orderId, {
      status: "cancelada",
      cancelReason: reason,
      closedAt: new Date().toISOString(),
    })
  }, [orderId, updateRestaurantOrder])

  // Get open orders
  const getOpenOrders = useCallback(() => {
    return restaurantOrders.filter(o => o.status === "aberta")
  }, [restaurantOrders])

  // Get orders by date
  const getOrdersByDate = useCallback((date: string) => {
    return restaurantOrders.filter(o => o.openedAt.startsWith(date))
  }, [restaurantOrders])

  return {
    order,
    totals,
    discount,
    addItem,
    removeItem,
    updateItemQuantity,
    applyDiscount,
    closeOrder,
    cancelOrder,
    getOpenOrders,
    getOrdersByDate,
  }
}
