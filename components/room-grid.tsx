"use client"
import { useTaskState } from "@/contexts/task-drafts-context"
import { PermissionGate } from "@/components/permission-gate"

import { businessDay } from "@/lib/utils/business-values"
import { CashTurnShortcut } from "./cash-turn-shortcut"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { RoomCard } from "./room-card"
import { RoomFilters, type Filter } from "./room-filters"
import { ManageRoomsModal } from "./manage-rooms-modal"
import { Input } from "./ui/input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarDays, ChevronLeft, ChevronRight, Settings2 } from "lucide-react"
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
    const iso = businessDay(d)
    dates.push({
      date: iso,
      weekday: weekdays[d.getDay()],
      day: String(d.getDate()),
      month: months[d.getMonth()],
      isToday: iso === businessDay(today),
    })
  }
  return dates
}

export function RoomGrid() {
  const { rooms } = useApp()
  const [filter, setFilter] = useTaskState<Filter>("map.filter", "todos", false)
  const [weekOffset, setWeekOffset] = useTaskState("map.weekOffset", 0, false)
  const [selectedDate, setSelectedDate] = useTaskState<string>("map.selectedDate", businessDay(), false)
  const [manageRoomsOpen, setManageRoomsOpen] = useState(false)
  const [search, setSearch] = useTaskState("map.search", "", false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const weekDates = getWeekDates(weekOffset)
  const calendarDate = parseISO(selectedDate)

  function moveWeek(step: number) {
    const nextOffset = weekOffset + step
    setWeekOffset(nextOffset)
    setSelectedDate(getWeekDates(nextOffset)[0].date)
  }

  function selectCalendarDate(date: Date | undefined) {
    if (!date) return
    setSelectedDate(format(date, "yyyy-MM-dd"))
    setWeekOffset(Math.floor(differenceInCalendarDays(date, parseISO(businessDay())) / 7))
    setCalendarOpen(false)
  }

  const filtered =
    rooms.filter(r => (filter === "todos" || r.status === filter) && `${r.number} ${r.guest ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))

  return (
    <div className="room-map flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2"><CashTurnShortcut /></div>
      <div className="sm:hidden space-y-2">
        <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">Agora · {rooms.filter(r => r.status === "disponivel").length} quartos livres</span><PermissionGate permission="rooms.edit"><Button variant="outline" size="icon" aria-label="Gerenciar quartos" onClick={() => setManageRoomsOpen(true)}><Settings2 className="size-4" /></Button></PermissionGate></div>
        <Input aria-label="Buscar quarto ou hóspede" placeholder="Buscar quarto ou hóspede" value={search} onChange={event => setSearch(event.target.value)} />
      </div>
      {/* Interactive date selector */}
      <div className="grid w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 sm:flex sm:flex-col sm:gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="room-date-strip contents sm:flex sm:min-w-0 sm:max-w-full sm:items-center sm:gap-2 sm:pb-1 xl:col-start-2" role="group" aria-label="Navegar pelos dias">
          <Button variant="outline" size="icon" aria-label="Semana anterior" className="col-start-1 row-start-1 size-9 shrink-0" onClick={() => moveWeek(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="col-span-3 row-start-2 grid grid-cols-7 gap-1 sm:flex sm:gap-1.5">
            {weekDates.map((d) => (
              <button
                key={d.date}
                type="button"
                aria-label={format(parseISO(d.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                aria-pressed={d.date === selectedDate}
                onClick={() => setSelectedDate(d.date)}
                className={`room-day-choice flex min-w-0 flex-col items-center rounded-xl px-0 py-2 transition-all cursor-pointer sm:min-w-[56px] sm:px-3 ${
                  d.date === selectedDate
                    ? "bg-primary text-primary-foreground shadow-sm scale-105"
                    : d.isToday
                      ? "bg-primary/10 text-primary hover:bg-primary/15"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                <span className="text-[10px] uppercase font-medium opacity-80">{d.weekday}</span>
                <span className="text-lg font-bold tabular-nums leading-tight">{d.day}</span>
                <span className="hidden text-[9px] uppercase opacity-60 sm:inline">{d.month}</span>
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" aria-label="Próxima semana" className="col-start-3 row-start-1 size-9 shrink-0" onClick={() => moveWeek(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-center gap-1 sm:gap-2 xl:col-start-3 xl:justify-self-end">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" aria-label="Escolher data no calendário">
                <CalendarDays className="size-4" />
                <span className="text-xs sm:hidden">{format(parseISO(weekDates[0].date), "d MMM", { locale: ptBR })} – {format(parseISO(weekDates[6].date), "d MMM", { locale: ptBR })}</span>
                <span className="hidden sm:inline">Calendário</span><span className="hidden tabular-nums text-muted-foreground sm:inline">{format(calendarDate, "dd/MM/yyyy")}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto max-w-[calc(100vw-1.5rem)] p-0" align="center" collisionPadding={12} aria-label="Calendário do mapa de quartos">
              <Calendar
                className="room-map-calendar [--cell-size:2rem] sm:[--cell-size:2.25rem]"
                mode="single"
                required
                locale={ptBR}
                selected={calendarDate}
                defaultMonth={calendarDate}
                onSelect={selectCalendarDate}
                labels={{
                  labelPrevious: () => "Mês anterior",
                  labelNext: () => "Próximo mês",
                  labelDayButton: (date, modifiers) => `${format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}${modifiers.today ? ", hoje" : ""}${modifiers.selected ? ", selecionado" : ""}`,
                }}
                autoFocus
              />
              <div className="border-t p-2 sm:hidden">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => selectCalendarDate(parseISO(businessDay()))}>Voltar para hoje</Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="link" size="sm" className="hidden text-xs shrink-0 sm:inline-flex" onClick={() => { setWeekOffset(0); setSelectedDate(businessDay()) }}>
            Hoje
          </Button>
        </div>
      </div>

      <div className="room-filter-bar flex items-center justify-between gap-4 flex-wrap">
        <Input className="hidden sm:block sm:max-w-xs" aria-label="Buscar quarto ou hóspede" placeholder="Buscar quarto ou hóspede" value={search} onChange={event => setSearch(event.target.value)} />
        <RoomFilters active={filter} onChange={setFilter} />
        <div className="hidden sm:flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "quarto" : "quartos"}
          </p>
          <PermissionGate permission="rooms.edit"><Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setManageRoomsOpen(true)}>
            <Settings2 className="size-3.5" />
            <span className="hidden sm:inline">Gerenciar Quartos</span><span className="sm:hidden">Gerenciar</span>
          </Button></PermissionGate>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground sm:hidden" aria-label="Legenda da agenda">
        {[["bg-success", "Livre"], ["bg-warning", "Ocupado"], ["bg-cleaning", "Limpeza"], ["bg-info", "Bloqueado"]].map(([color, label]) => <span key={label} className="inline-flex items-center gap-1"><span aria-hidden="true" className={`size-2 rounded-full ${color}`} />{label}</span>)}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 sm:auto-rows-fr sm:grid-cols-2 sm:items-stretch lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((room) => (
          <RoomCard key={room.id} room={room} selectedDate={selectedDate} />
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
