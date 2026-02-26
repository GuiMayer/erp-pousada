"use client"

import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { RoomCard } from "./room-card"
import { RoomFilters, type Filter } from "./room-filters"
import { ManageRoomsModal } from "./manage-rooms-modal"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react"
import type { RoomStatus } from "@/lib/store"

function getWeekDates(offset: number) {
  const dates: { date: string; weekday: string; day: string; month: string; isToday: boolean }[] = []
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
      weekday: weekdays[d.getDay()],
      day: String(d.getDate()),
      month: months[d.getMonth()],
      isToday: iso === today.toISOString().split("T")[0],
    })
  }
  return dates
}

export function RoomGrid() {
  const { rooms } = useApp()
  const [filter, setFilter] = useState<Filter>("todos")
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [manageRoomsOpen, setManageRoomsOpen] = useState(false)
  const weekDates = getWeekDates(weekOffset)

  const filtered =
    filter === "todos" ? rooms : rooms.filter((r) => r.status === filter)

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Interactive date selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setWeekOffset(p => p - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex gap-1.5 overflow-x-auto flex-1 justify-center">
          {weekDates.map((d) => (
            <button
              key={d.date}
              onClick={() => setSelectedDate(d.date)}
              className={`flex flex-col items-center rounded-xl px-3 py-2 transition-all cursor-pointer min-w-[56px] ${
                d.date === selectedDate
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : d.isToday
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              <span className="text-[10px] uppercase font-medium opacity-80">{d.weekday}</span>
              <span className="text-lg font-bold tabular-nums leading-tight">{d.day}</span>
              <span className="text-[9px] uppercase opacity-60">{d.month}</span>
            </button>
          ))}
        </div>
        <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setWeekOffset(p => p + 1)}>
          <ChevronRight className="size-4" />
        </Button>
        {weekOffset !== 0 && (
          <Button variant="link" size="sm" className="text-xs shrink-0" onClick={() => { setWeekOffset(0); setSelectedDate(new Date().toISOString().split("T")[0]) }}>
            Hoje
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <RoomFilters active={filter} onChange={setFilter} />
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "quarto" : "quartos"}
          </p>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setManageRoomsOpen(true)}>
            <Settings2 className="size-3.5" />
            Gerenciar Quartos
          </Button>
        </div>
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

      <ManageRoomsModal open={manageRoomsOpen} onClose={() => setManageRoomsOpen(false)} />
    </div>
  )
}
