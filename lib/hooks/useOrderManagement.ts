import { useState, useCallback, useMemo } from "react"
import { useApp } from "../app-context"
import type { RestaurantOrder, RestaurantOrderItem, POSProduct } from "../store"
import { generateOrderItemId } from "../utils/id-generators"
import { getTodayISO } from "../utils/constants"

type OrderActionResult = { success: boolean; error?: string }

function calculateTotals(items: RestaurantOrderItem[], discountPercent: number) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const discount = (subtotal * discountPercent) / 100
  const total = subtotal - discount

  return { subtotal, discount, total }
}

/**
 * Hook for managing restaurant orders (comandas)
 * Provides utilities for creating, updating, and managing order items
 */
export function useOrderManagement(orderId?: string) {
  const {
    restaurantOrders,
    updateRestaurantOrder,
    addTransaction,
    addAuditEntry,
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

    return calculateTotals(order.items, discount)
  }, [order, discount])

  // Add item to order
  const addItem = useCallback((product: POSProduct, quantity: number = 1) => {
    if (!order || !orderId || order.status !== "aberta") return

    const item: RestaurantOrderItem = {
      id: generateOrderItemId(),
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: product.price,
      subtotal: product.price * quantity,
      category: getCategoryName(product.categoryId),
    }

    const items = [...order.items, item]
    updateRestaurantOrder(orderId, {
      items,
      ...calculateTotals(items, discount),
    })
  }, [order, orderId, discount, updateRestaurantOrder, getCategoryName])

  // Remove item from order
  const removeItem = useCallback((itemId: string) => {
    if (!order || !orderId || order.status !== "aberta") return

    const items = order.items.filter(item => item.id !== itemId)
    updateRestaurantOrder(orderId, {
      items,
      ...calculateTotals(items, discount),
    })
  }, [order, orderId, discount, updateRestaurantOrder])

  // Update item quantity
  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    if (!order || !orderId || order.status !== "aberta") return

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

    updateRestaurantOrder(orderId, {
      items: updatedItems,
      ...calculateTotals(updatedItems, discount),
    })
  }, [order, orderId, discount, updateRestaurantOrder])

  // Apply discount to order
  const applyDiscount = useCallback((discountPercent: number) => {
    setDiscount(discountPercent)
    if (order && orderId && order.status === "aberta") {
      updateRestaurantOrder(orderId, calculateTotals(order.items, discountPercent))
    }
  }, [order, orderId, updateRestaurantOrder])

  // Close order (finalize payment)
  const closeOrder = useCallback(async (
    paymentMethod: string,
    amountPaid: number,
    customer?: string,
    operator = "sistema"
  ): Promise<OrderActionResult> => {
    if (!order || !orderId) return { success: false, error: "Comanda nao encontrada" }
    if (order.status !== "aberta") return { success: false, error: "Comanda nao esta aberta" }
    if (order.items.length === 0) return { success: false, error: "Comanda sem itens" }
    if (!paymentMethod) return { success: false, error: "Informe a forma de pagamento" }
    if (!Number.isFinite(amountPaid) || amountPaid < totals.total) {
      return { success: false, error: "Valor pago insuficiente" }
    }

    const change = amountPaid - totals.total

    await updateRestaurantOrder(orderId, {
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

    await addTransaction({
      id: `T${Date.now()}`,
      date: getTodayISO(),
      description: `Comanda Restaurante ${order.id} - Mesa ${order.tableNumber}`,
      value: totals.total,
      type: "receita",
      refId: order.id,
      category: "Restaurante",
      paymentMethod,
      responsible: operator,
    })

    await addAuditEntry({
      user: operator,
      action: "Comanda fechada",
      reference: `Mesa ${order.tableNumber} - ${order.id} - R$ ${totals.total.toFixed(2)}`,
    })

    return { success: true }
  }, [order, orderId, totals, updateRestaurantOrder, addTransaction, addAuditEntry])

  // Cancel order
  const cancelOrder = useCallback(async (
    reason: string,
    operator = "sistema"
  ): Promise<OrderActionResult> => {
    const trimmedReason = reason.trim()

    if (!order || !orderId) return { success: false, error: "Comanda nao encontrada" }
    if (order.status !== "aberta") return { success: false, error: "Comanda nao esta aberta" }
    if (!trimmedReason) return { success: false, error: "Informe o motivo do cancelamento" }

    await updateRestaurantOrder(orderId, {
      status: "cancelada",
      cancelReason: trimmedReason,
      closedAt: new Date().toISOString(),
    })

    await addAuditEntry({
      user: operator,
      action: "Comanda cancelada",
      reference: `Mesa ${order.tableNumber} - ${order.id} - ${trimmedReason}`,
    })

    return { success: true }
  }, [order, orderId, updateRestaurantOrder, addAuditEntry])

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
