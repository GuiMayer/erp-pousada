"use client"

import { TableCard } from "@/modules/abandoned/restaurant/components/table-card"
import { EmptyState } from "@/components/ui/empty-state"
import { UtensilsCrossed } from "lucide-react"
import type { RestaurantOrder, RestaurantTable } from "@/lib/store"

interface TableGridProps {
  tables: RestaurantTable[]
  orders: RestaurantOrder[]
  onTableClick: (table: RestaurantTable) => void
  getOccupiedTime: (table: RestaurantTable) => number
}

export function TableGrid({ tables, orders, onTableClick, getOccupiedTime }: TableGridProps) {
  if (tables.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Nenhuma mesa encontrada"
        description="Não há mesas cadastradas ou nenhuma mesa corresponde ao filtro selecionado."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {tables.map(table => (
        <TableCard
          key={table.id}
          table={table}
          activeOrder={orders.find(order => order.id === table.currentOrderId && order.status === "aberta")}
          occupiedTime={getOccupiedTime(table)}
          onClick={() => onTableClick(table)}
        />
      ))}
    </div>
  )
}
