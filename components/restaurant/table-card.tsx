"use client"

import { Clock, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { RestaurantTable } from "@/lib/store"
import { cn } from "@/lib/utils"

interface TableCardProps {
  table: RestaurantTable
  occupiedTime?: number
  onClick?: () => void
}

const statusConfig = {
  livre: {
    label: "Livre",
    color: "bg-green-500/10 text-green-700 border-green-200",
    cardBorder: "border-green-200",
  },
  ocupada: {
    label: "Ocupada",
    color: "bg-orange-500/10 text-orange-700 border-orange-200",
    cardBorder: "border-orange-200",
  },
  reservada: {
    label: "Reservada",
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
    cardBorder: "border-blue-200",
  },
}

export function TableCard({ table, occupiedTime, onClick }: TableCardProps) {
  const config = statusConfig[table.status]
  const isOccupied = table.status === "ocupada"
  const isLongOccupied = occupiedTime && occupiedTime > 120

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        config.cardBorder,
        isLongOccupied && "border-red-300"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-2xl font-bold">Mesa {table.number}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Users className="h-3 w-3" />
              <span>{table.capacity} lugares</span>
            </div>
          </div>
          <Badge variant="outline" className={config.color}>
            {config.label}
          </Badge>
        </div>

        {isOccupied && occupiedTime !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className={cn("h-4 w-4", isLongOccupied && "text-red-500")} />
            <span className={cn(isLongOccupied && "text-red-500 font-medium")}>
              {Math.floor(occupiedTime / 60)}h {occupiedTime % 60}min
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
