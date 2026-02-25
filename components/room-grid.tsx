"use client"

import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { RoomCard } from "./room-card"
import { RoomFilters, type Filter } from "./room-filters"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { RoomStatus } from "@/lib/store"

function getWeekDates(offset: number) {
  const dates: { date: string; label: string; isToday: boolean }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() + offset * 7)

  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().split("T")[0]
    dates.push({
      date: iso,
      label: `${weekdays[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`,
      isToday: iso === today.toISOString().split("T")[0],
    })
  }
  return dates
}

export function RoomGrid() {
  const { rooms } = useApp()
  const [filter, setFilter] = useState<Filter>("todos")
  const [weekOffset, setWeekOffset] = useState(0)
  const weekDates = getWeekDates(weekOffset)

  const filtered =
    filter === "todos" ? rooms : rooms.filter((r) => r.status === filter)

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Date selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => setWeekOffset(p => p - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex gap-1 overflow-x-auto">
          {weekDates.map((d) => (
            <div
              key={d.date}
              className={`flex flex-col items-center rounded-lg px-2.5 py-1.5 text-xs ${
                d.isToday ? "bg-primary text-primary-foreground font-bold" : "bg-secondary text-secondary-foreground"
              }`}
            >
              <span className="text-[10px] uppercase">{d.label.split(" ")[0]}</span>
              <span className="font-semibold tabular-nums">{d.label.split(" ")[1]}</span>
              <span className="text-[9px] opacity-70">{d.label.split(" ")[2]}</span>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => setWeekOffset(p => p + 1)}>
          <ChevronRight className="size-4" />
        </Button>
        {weekOffset !== 0 && (
          <Button variant="link" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>
            Hoje
          </Button>
        )}
      </div>

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
          <p className="text-lg font-medium text-muted-foreground">Nenhum quarto encontrado</p>
          <p className="text-sm text-muted-foreground/70">Tente um filtro diferente</p>
        </div>
      )}
    </div>
  )
}
