"use client"

import { TableCard } from "./table-card"
import { EmptyState } from "@/components/ui/empty-state"
import { UtensilsCrossed } from "lucide-react"
import type { RestaurantTable } from "@/lib/store"

interface TableGridProps {
  tables: RestaurantTable[]
  onTableClick: (table: RestaurantTable) => void
  getOccupiedTime: (table: RestaurantTable) => number
}

export function TableGrid({ tables, onTableClick, getOccupiedTime }: TableGridProps) {
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
          occupiedTime={getOccupiedTime(table)}
          onClick={() => onTableClick(table)}
        />
      ))}
    </div>
  )
}
