import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  User,
  CalendarClock,
  DoorOpen,
  Wrench,
  BedDouble,
} from "lucide-react"
import type { Room, RoomStatus } from "@/lib/room-data"
import { MiniTimeline } from "./mini-timeline"

const statusConfig: Record<
  RoomStatus,
  {
    label: string
    badgeClass: string
    cardBorderClass: string
    icon: React.ReactNode
  }
> = {
  livre: {
    label: "Livre",
    badgeClass: "bg-success text-success-foreground border-transparent",
    cardBorderClass: "border-success/30 hover:border-success/50",
    icon: <DoorOpen className="size-3.5" />,
  },
  ocupado: {
    label: "Ocupado",
    badgeClass: "bg-warning text-warning-foreground border-transparent",
    cardBorderClass: "border-warning/30 hover:border-warning/50",
    icon: <BedDouble className="size-3.5" />,
  },
  manutencao: {
    label: "Manut.",
    badgeClass: "bg-destructive text-destructive-foreground border-transparent",
    cardBorderClass: "border-destructive/30 hover:border-destructive/50",
    icon: <Wrench className="size-3.5" />,
  },
}

function formatDateBR(iso: string) {
  const date = new Date(iso + "T12:00:00")
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

function daysUntil(iso: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso + "T12:00:00")
  target.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return "Hoje"
  if (diff === 1) return "Amanha"
  return `${diff} dias`
}

export function RoomCard({ room }: { room: Room }) {
  const config = statusConfig[room.status]

  return (
    <Card
      className={`group relative overflow-hidden transition-all duration-200 hover:shadow-md ${config.cardBorderClass}`}
    >
      {/* Status accent line */}
      <div
        className={`absolute inset-x-0 top-0 h-1 ${
          room.status === "livre"
            ? "bg-success"
            : room.status === "ocupado"
            ? "bg-warning"
            : "bg-destructive"
        }`}
      />

      <CardHeader className="pb-0 pt-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {room.number}
            </span>
            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {room.type}
            </span>
          </div>
          <Badge className={`${config.badgeClass} gap-1 text-[11px]`}>
            {config.icon}
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="py-0">
        {room.status === "ocupado" && room.guest && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg bg-secondary/60 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <User className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {room.guest}
              </span>
            </div>
            {room.checkOut && (
              <div className="flex items-center gap-2">
                <CalendarClock className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {"Saida: "}
                  <span className="font-medium text-foreground">
                    {formatDateBR(room.checkOut)}
                  </span>
                  <span className="ml-1.5 rounded bg-warning/15 px-1 py-0.5 text-[10px] font-medium text-warning-foreground">
                    {daysUntil(room.checkOut)}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {room.status === "livre" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/5 px-3 py-2.5">
            <DoorOpen className="size-4 text-success" />
            <span className="text-sm text-success">
              Disponivel para reserva
            </span>
          </div>
        )}

        {room.status === "manutencao" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/5 px-3 py-2.5">
            <Wrench className="size-4 text-destructive" />
            <span className="text-sm text-destructive">
              Em manutencao
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-0 pb-4 pt-0">
        <Separator className="mb-3 mt-3" />
        <MiniTimeline days={room.timeline} />
      </CardFooter>
    </Card>
  )
}
