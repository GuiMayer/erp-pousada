import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { TimelineDay, RoomStatus } from "@/lib/store"

const statusColors: Record<RoomStatus, string> = {
  disponivel: "bg-success",
  ocupado: "bg-warning",
  limpeza: "bg-cleaning",
  bloqueado: "bg-info",
}

const statusLabels: Record<RoomStatus, string> = {
  disponivel: "Disponivel",
  ocupado: "Ocupado",
  limpeza: "Limpeza",
  bloqueado: "Bloqueado",
}

export function MiniTimeline({ days, startIndex = 0 }: { days: TimelineDay[]; startIndex?: number }) {
  const todayISO = new Date().toISOString().split("T")[0]

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Agenda 7 dias
          </span>
        </div>
        <div className="flex items-center gap-1">
          {days.map((day, i) => {
            const isToday = day.date === todayISO
            const isEdge = (i === 0 || i === days.length - 1) && day.status === "ocupado"

            return (
              <Tooltip key={day.date}>
                <TooltipTrigger asChild>
                  <div className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`h-2 w-full rounded-full transition-all ${statusColors[day.status]} ${
                        isToday ? "ring-2 ring-foreground/20 ring-offset-1 ring-offset-card" : ""
                      } ${isEdge ? "opacity-60" : ""}`}
                    />
                    <span
                      className={`text-[9px] tabular-nums ${
                        isToday ? "font-bold text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {day.label.split(" ")[0]}
                    </span>
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
