import { useState, useCallback, useMemo } from "react"
import { useApp } from "@/lib/app-context"
import type { RestaurantTable, TableStatus } from "@/lib/store"

/**
 * Hook for managing restaurant tables
 * Provides utilities for opening, closing, and filtering tables
 */
export function useTableManagement() {
  const { restaurantTables, updateRestaurantTable } = useApp()
  const [filter, setFilter] = useState<TableStatus | "all">("all")

  // Filter tables by status
  const filteredTables = useMemo(() => {
    if (filter === "all") return restaurantTables
    return restaurantTables.filter(t => t.status === filter)
  }, [restaurantTables, filter])

  // Get table by ID
  const getTable = useCallback((id: number) => {
    return restaurantTables.find(t => t.id === id)
  }, [restaurantTables])

  // Open a table (mark as occupied)
  const openTable = useCallback(async (tableId: number, orderId: string) => {
    await updateRestaurantTable(tableId, {
      status: "ocupada",
      currentOrderId: orderId,
      openedAt: new Date().toISOString(),
    })
  }, [updateRestaurantTable])

  // Close a table (mark as free)
  const closeTable = useCallback(async (tableId: number) => {
    await updateRestaurantTable(tableId, {
      status: "livre",
      currentOrderId: undefined,
      openedAt: undefined,
    })
  }, [updateRestaurantTable])

  // Reserve a table
  const reserveTable = useCallback(async (tableId: number) => {
    await updateRestaurantTable(tableId, {
      status: "reservada",
    })
  }, [updateRestaurantTable])

  // Cancel reservation
  const cancelReservation = useCallback(async (tableId: number) => {
    await updateRestaurantTable(tableId, {
      status: "livre",
    })
  }, [updateRestaurantTable])

  // Get occupied time in minutes
  const getOccupiedTime = useCallback((table: RestaurantTable): number => {
    if (!table.openedAt) return 0
    const opened = new Date(table.openedAt)
    const now = new Date()
    return Math.floor((now.getTime() - opened.getTime()) / 60000)
  }, [])

  // Check if table has been occupied for too long (> 2 hours)
  const isOccupiedTooLong = useCallback((table: RestaurantTable): boolean => {
    return getOccupiedTime(table) > 120
  }, [getOccupiedTime])

  // Get statistics
  const stats = useMemo(() => {
    const total = restaurantTables.length
    const occupied = restaurantTables.filter(t => t.status === "ocupada").length
    const free = restaurantTables.filter(t => t.status === "livre").length
    const reserved = restaurantTables.filter(t => t.status === "reservada").length
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0

    return { total, occupied, free, reserved, occupancyRate }
  }, [restaurantTables])

  return {
    tables: filteredTables,
    allTables: restaurantTables,
    filter,
    setFilter,
    getTable,
    openTable,
    closeTable,
    reserveTable,
    cancelReservation,
    getOccupiedTime,
    isOccupiedTooLong,
    stats,
  }
}
