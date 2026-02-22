"use client"

import { useState } from "react"
import { rooms } from "@/lib/room-data"
import { RoomCard } from "./room-card"
import { RoomFilters, type Filter } from "./room-filters"
import { DashboardHeader } from "./dashboard-header"

export function RoomGrid() {
  const [filter, setFilter] = useState<Filter>("todos")

  const filtered =
    filter === "todos" ? rooms : rooms.filter((r) => r.status === filter)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <DashboardHeader rooms={rooms} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <RoomFilters active={filter} onChange={setFilter} />
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "quarto" : "quartos"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Nenhum quarto encontrado
          </p>
          <p className="text-sm text-muted-foreground/70">
            Tente um filtro diferente
          </p>
        </div>
      )}
    </div>
  )
}
