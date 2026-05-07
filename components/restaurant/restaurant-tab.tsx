"use client"

import { useState } from "react"
import { UtensilsCrossed, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableGrid } from "./table-grid"
import { OrderSheet } from "./order-sheet"
import { useTableManagement } from "@/lib/hooks/useTableManagement"
import { useApp } from "@/lib/app-context"
import type { RestaurantTable, RestaurantOrder } from "@/lib/store"

export function RestaurantTab() {
  const { addRestaurantOrder, updateRestaurantTable } = useApp()
  const {
    tables,
    filter,
    setFilter,
    stats,
    getOccupiedTime,
    openTable,
    closeTable,
  } = useTableManagement()

  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null)
  const [orderSheetOpen, setOrderSheetOpen] = useState(false)

  const handleTableClick = (table: RestaurantTable) => {
    if (table.status === "livre") {
      // Open new order
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newOrder: RestaurantOrder = {
        id: orderId,
        tableId: table.id,
        tableNumber: table.number,
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0,
        status: "aberta",
        openedAt: new Date().toISOString(),
        operator: "operador",
      }
      addRestaurantOrder(newOrder)
      openTable(table.id, orderId)
      setSelectedTable({ ...table, currentOrderId: orderId })
    } else {
      setSelectedTable(table)
    }
    setOrderSheetOpen(true)
  }

  const handleOrderSheetClose = () => {
    setOrderSheetOpen(false)
    if (selectedTable) {
      closeTable(selectedTable.id)
    }
    setSelectedTable(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="h-8 w-8" />
            Restaurante
          </h2>
          <p className="text-muted-foreground">
            Gerencie mesas e comandas do restaurante
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Total de Mesas</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Ocupadas</div>
          <div className="text-2xl font-bold text-orange-600">{stats.occupied}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Livres</div>
          <div className="text-2xl font-bold text-green-600">{stats.free}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Taxa de Ocupação</div>
          <div className="text-2xl font-bold">{stats.occupancyRate}%</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Mesas</SelectItem>
              <SelectItem value="livre">Livres</SelectItem>
              <SelectItem value="ocupada">Ocupadas</SelectItem>
              <SelectItem value="reservada">Reservadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tables Grid */}
      <TableGrid
        tables={tables}
        onTableClick={handleTableClick}
        getOccupiedTime={getOccupiedTime}
      />

      {/* Order Sheet */}
      <OrderSheet
        open={orderSheetOpen}
        onOpenChange={setOrderSheetOpen}
        table={selectedTable}
        onClose={handleOrderSheetClose}
      />
    </div>
  )
}
