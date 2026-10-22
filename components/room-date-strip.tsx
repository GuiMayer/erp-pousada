"use client"

import { useState } from "react"
import { addDays, differenceInCalendarWeeks, format, parseISO, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { businessDay } from "@/lib/utils/business-values"
import { Button } from "./ui/button"

export function getWeekDates(offset: number) {
  const today = businessDay()
  const sunday = startOfWeek(parseISO(today), { weekStartsOn: 0 })
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(sunday, offset * 7 + index)
    return { date: format(date, "yyyy-MM-dd"), weekday: format(date, "EEE", { locale: ptBR }).slice(0, 3),
      day: format(date, "d"), month: format(date, "MMM", { locale: ptBR }), isToday: format(date, "yyyy-MM-dd") === today }
  })
}

export function getWeekOffset(date: Date) {
  return differenceInCalendarWeeks(date, parseISO(businessDay()), { weekStartsOn: 0 })
}

export function RoomDateStrip({ offset, selectedDate, onNavigate, onSelect }: {
  offset: number; selectedDate: string; onNavigate: (step: number) => void; onSelect: (date: string) => void
}) {
  const [slide, setSlide] = useState<{ from: number; direction: "next" | "previous"; id: number } | null>(null)
  function navigate(step: number) {
    setSlide(previous => ({ from: offset, direction: step > 0 ? "next" : "previous", id: (previous?.id ?? 0) + 1 }))
    onNavigate(step)
  }
  function days(weekOffset: number, outgoing = false) {
    return getWeekDates(weekOffset).map(d => (
      <button key={d.date} type="button" disabled={outgoing} tabIndex={outgoing ? -1 : undefined}
        aria-label={format(parseISO(d.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        aria-pressed={d.date === selectedDate} onClick={() => onSelect(d.date)}
        className={`room-day-choice flex min-w-0 flex-col items-center rounded-xl px-0 py-2 transition-colors cursor-pointer sm:min-w-[56px] sm:px-3 ${
          d.date === selectedDate ? "bg-primary text-primary-foreground shadow-sm scale-105"
            : d.isToday ? "bg-primary/10 text-primary hover:bg-primary/15" : "bg-secondary text-secondary-foreground hover:bg-accent"
        }`}>
        <span className="text-[10px] uppercase font-medium opacity-80">{d.weekday}</span>
        <span className="text-lg font-bold tabular-nums leading-tight">{d.day}</span>
        <span className="hidden text-[9px] uppercase opacity-60 sm:inline">{d.month}</span>
      </button>
    ))
  }
  return <div className="room-date-strip contents sm:flex sm:min-w-0 sm:max-w-full sm:items-center sm:gap-2 xl:col-start-2" role="group" aria-label="Navegar pelos dias">
    <Button variant="outline" size="icon" aria-label="Semana anterior" className="col-start-1 row-start-1 size-9 shrink-0" onClick={() => navigate(-1)}><ChevronLeft className="size-4" /></Button>
    <div className="room-date-viewport relative col-span-3 row-start-2 min-w-0 overflow-hidden py-1 sm:w-[448px]" data-direction={slide?.direction}>
      {slide && <div key={`out-${slide.id}`} aria-hidden="true" inert className="room-date-page room-date-out absolute inset-x-0 top-1 grid grid-cols-7 gap-1 sm:gap-1.5">{days(slide.from, true)}</div>}
      <div key={`in-${offset}`} className={`room-date-page grid grid-cols-7 gap-1 sm:gap-1.5 ${slide ? "room-date-in" : ""}`} onAnimationEnd={event => { if (event.target === event.currentTarget) setSlide(null) }}>{days(offset)}</div>
    </div>
    <Button variant="outline" size="icon" aria-label="Próxima semana" className="col-start-3 row-start-1 size-9 shrink-0" onClick={() => navigate(1)}><ChevronRight className="size-4" /></Button>
  </div>
}
