import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { TimelineDay, RoomStatus } from "@/lib/store"
import { businessDay } from "@/lib/utils/business-values"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

const statusColors: Record<RoomStatus, string> = {
  disponivel: "bg-success",
  ocupado: "bg-warning",
  limpeza: "bg-cleaning",
  bloqueado: "bg-info",
}

const statusLabels: Record<RoomStatus, string> = {
  disponivel: "Disponível",
  ocupado: "Ocupado",
  limpeza: "Limpeza",
  bloqueado: "Bloqueado",
}
const shortStatus: Record<RoomStatus, string> = { disponivel: "Livre", ocupado: "Ocup.", limpeza: "Limp.", bloqueado: "Bloq." }

export function MiniTimeline({ days, startIndex = 0, highlightDate }: { days: TimelineDay[]; startIndex?: number; highlightDate?: string }) {
  const todayISO = businessDay()

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Agenda 7 dias
          </span>
          {days.length > 0 && <span className="text-[10px] text-muted-foreground sm:hidden">{format(parseISO(days[0].date), "dd/MM")} – {format(parseISO(days[days.length - 1].date), "dd/MM")}</span>}
        </div>
        <div className="grid grid-cols-7 gap-1 w-full">
          {days.map((day, i) => {
            const isToday = day.date === todayISO
            const isHighlighted = highlightDate && day.date === highlightDate
            const isEdge = (i === 0 || i === days.length - 1) && day.status === "ocupado"

            return (
              <Tooltip key={day.date}>
                <TooltipTrigger asChild>
                  <div className="flex min-w-0 flex-col items-center gap-1" aria-label={`${format(parseISO(day.date), "EEEE, d 'de' MMMM", { locale: ptBR })}: ${statusLabels[day.status]}`}>
                    <span className="text-[9px] uppercase text-muted-foreground sm:hidden">{format(parseISO(day.date), "EEE", { locale: ptBR }).slice(0, 3)}</span>
                    <div
                      className={`h-2 w-full rounded-full transition-all ${statusColors[day.status]} ${
                        isHighlighted ? "ring-2 ring-primary ring-offset-1 ring-offset-card scale-110" : 
                        isToday ? "ring-2 ring-foreground/20 ring-offset-1 ring-offset-card" : ""
                      } ${isEdge ? "opacity-60" : ""}`}
                    />
                    <span
                      className={`text-[11px] tabular-nums sm:text-[9px] ${
                        isHighlighted ? "font-bold text-primary" :
                        isToday ? "font-bold text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span className="sm:hidden">{format(parseISO(day.date), "d")}</span><span className="hidden sm:inline">{day.label.split(" ")[0]}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground sm:hidden">{shortStatus[day.status]}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">{day.label}</p>
                  <p className="text-muted-foreground">
                    {statusLabels[day.status]}
                    {isEdge && " >"}
                  </p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}
