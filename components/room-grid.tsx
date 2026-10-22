"use client"
import { useAuth } from "@/lib/auth-context"
import { roomPlan } from "@/lib/room-planning"
import { useTaskState } from "@/contexts/task-drafts-context"
import { PermissionGate } from "@/components/permission-gate"

import { businessDay } from "@/lib/utils/business-values"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { RoomCard } from "./room-card"
import { RoomFilters, type Filter } from "./room-filters"
import { ManageRoomsModal } from "./manage-rooms-modal"
import { Input } from "./ui/input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarDays, Settings2 } from "lucide-react"
import { RoomDateStrip, getWeekDates, getWeekOffset } from "./room-date-strip"

export function RoomGrid() {
  const { rooms, reservations = [], stays = [] } = useApp()
  const { can } = useAuth()
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
  }

  function selectCalendarDate(date: Date | undefined) {
    if (!date) return
    setSelectedDate(format(date, "yyyy-MM-dd"))
    setWeekOffset(getWeekOffset(date))
    setCalendarOpen(false)
  }

  const future = selectedDate > businessDay()
  const effectiveFilter = future && filter === "limpeza" ? "todos" : filter
  const forecasts = rooms.map(room => ({ room, plan: future ? roomPlan(room, can("reservations.read") ? reservations : [], can("stays.read") ? stays : [], selectedDate) : undefined }))
  const availableCount = forecasts.filter(({ room, plan }) => (plan?.status ?? room.status) === "disponivel").length
  const filtered = forecasts.filter(({ room, plan }) => {
    const status = plan?.status ?? room.status
    const guests = plan ? [...plan.reservations.map(r => r.guestName), ...plan.stays.map(s => s.guestName)].join(" ") : room.guest ?? ""
    return (effectiveFilter === "todos" || status === effectiveFilter) && `${room.number} ${guests}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))
  }).map(({ room }) => room)

  return (
    <div className="room-map flex flex-col gap-4 animate-fade-in">
      <div className="sm:hidden space-y-2">
        <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{future ? format(calendarDate, "dd/MM") : "Agora"} · {availableCount} quartos {future ? "previstos livres" : "livres"}</span><PermissionGate permission="rooms.edit"><Button variant="outline" size="icon" aria-label="Gerenciar quartos" onClick={() => setManageRoomsOpen(true)}><Settings2 className="size-4" /></Button></PermissionGate></div>
        <Input aria-label="Buscar quarto ou hóspede" placeholder="Buscar quarto ou hóspede" value={search} onChange={event => setSearch(event.target.value)} />
      </div>
      {/* Interactive date selector */}
      <div className="grid w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 sm:flex sm:flex-col sm:gap-2 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <RoomDateStrip offset={weekOffset} selectedDate={selectedDate} onNavigate={moveWeek} onSelect={setSelectedDate} />
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
                weekStartsOn={0}
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

      {future && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-secondary/50 p-3"><p role="status" className="text-sm">Planejamento para {format(calendarDate, "dd/MM/yyyy")}. Disponibilidade prevista; confirme a saída e a limpeza no dia. As ações operacionais ficam no atendimento atual.</p><Button size="sm" variant="outline" onClick={() => { setWeekOffset(0); setSelectedDate(businessDay()) }}>Voltar para hoje</Button></div>}
      <div className="room-filter-bar flex items-center justify-between gap-4 flex-wrap">
        <Input className="hidden sm:block sm:max-w-xs" aria-label="Buscar quarto ou hóspede" placeholder="Buscar quarto ou hóspede" value={search} onChange={event => setSearch(event.target.value)} />
        <RoomFilters active={effectiveFilter} onChange={setFilter} future={future} />
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
