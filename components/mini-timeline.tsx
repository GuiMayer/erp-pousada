"use client"

import { useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { TimelineDay, RoomStatus } from "@/lib/store"
import { businessDay } from "@/lib/utils/business-values"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

const statusColors: Record<RoomStatus, string> = {
  disponivel: "bg-success", ocupado: "bg-warning", limpeza: "bg-cleaning", bloqueado: "bg-info",
}
const statusLabels: Record<RoomStatus, string> = {
  disponivel: "Disponível", ocupado: "Ocupado", limpeza: "Limpeza", bloqueado: "Bloqueado",
}

export function MiniTimeline({ days, highlightDate }: { days: TimelineDay[]; startIndex?: number; highlightDate?: string }) {
  const today = businessDay()
  const [openDay, setOpenDay] = useState<string | null>(null)
  return <TooltipProvider delayDuration={200}>
    <div className="grid w-full grid-cols-7 gap-1" role="group" aria-label="Agenda dos próximos sete dias">
      {days.map(day => {
        const selected = day.date === highlightDate
        const current = day.date === today
        const dateLabel = format(parseISO(day.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
        const description = dateLabel + ": " + statusLabels[day.status]
        return <Popover key={day.date} open={openDay === day.date} onOpenChange={open => setOpenDay(open ? day.date : null)}>
          <Tooltip open={openDay === day.date ? false : undefined}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button type="button" aria-label={description} className="flex min-h-8 min-w-0 cursor-pointer flex-col justify-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
                  <span aria-hidden="true" className={`h-2 w-full rounded-full ${statusColors[day.status]} ${selected ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : current ? "ring-2 ring-foreground/20 ring-offset-1 ring-offset-card" : ""}`} />
                  <span aria-hidden="true" className={`text-[11px] tabular-nums sm:text-[9px] ${selected ? "font-bold text-primary" : current ? "font-bold text-foreground" : "text-muted-foreground"}`}>{format(parseISO(day.date), "d")}</span>
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{description}</TooltipContent>
          </Tooltip>
          <PopoverContent side="top" align="center" collisionPadding={12} aria-label={description} className="w-auto max-w-[calc(100vw-1.5rem)] p-3 text-xs">
            <p className="font-medium">{dateLabel}</p>
            <p className="mt-1 text-muted-foreground">{statusLabels[day.status]}</p>
          </PopoverContent>
        </Popover>
      })}
    </div>
  </TooltipProvider>
}
