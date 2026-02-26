"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  User, CalendarClock, DoorOpen, Lock, BedDouble,
  SprayCan, LogIn, LogOut as LogOutIcon, ShoppingCart,
  CheckCircle2, Eye, AlertTriangle,
} from "lucide-react"
import type { Room, RoomStatus } from "@/lib/store"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { MiniTimeline } from "./mini-timeline"
import { BlockRoomModal } from "./block-room-modal"
import { CheckinModal } from "./checkin-modal"
import { ConsumptionSheet } from "./consumption-sheet"

const statusConfig: Record<
  RoomStatus,
  { label: string; badgeClass: string; borderClass: string; accent: string; icon: React.ReactNode }
> = {
  disponivel: {
    label: "Disponivel",
    badgeClass: "bg-success text-success-foreground border-transparent",
    borderClass: "border-success/30 hover:border-success/50",
    accent: "bg-success",
    icon: <DoorOpen className="size-3.5" />,
  },
  ocupado: {
    label: "Ocupado",
    badgeClass: "bg-warning text-warning-foreground border-transparent",
    borderClass: "border-warning/30 hover:border-warning/50",
    accent: "bg-warning",
    icon: <BedDouble className="size-3.5" />,
  },
  limpeza: {
    label: "Limpeza",
    badgeClass: "bg-cleaning text-cleaning-foreground border-transparent",
    borderClass: "border-cleaning/30 hover:border-cleaning/50",
    accent: "bg-cleaning",
    icon: <SprayCan className="size-3.5" />,
  },
  bloqueado: {
    label: "Bloqueado",
    badgeClass: "bg-info text-info-foreground border-transparent",
    borderClass: "border-info/30 hover:border-info/50",
    accent: "bg-info",
    icon: <Lock className="size-3.5" />,
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
  if (diff < 0) return `${Math.abs(diff)}d atrasado`
  return `${diff} dias`
}

function isOverdue(room: Room): boolean {
  if (room.status !== "ocupado" || !room.checkOut) return false
  const now = new Date()
  const checkoutDate = new Date(room.checkOut + "T" + (room.checkOutTime || "12:00") + ":00")
  return now > checkoutDate
}

export function RoomCard({ room }: { room: Room }) {
  const config = statusConfig[room.status]
  const overdue = isOverdue(room)
  const { updateRoom, addAuditEntry, getConsumption, clearConsumption } = useApp()
  const { username } = useAuth()
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [consumptionOpen, setConsumptionOpen] = useState(false)

  const consumption = getConsumption(room.id)
  const consumptionTotal = consumption
    ? consumption.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    : 0

  function handleCheckOut() {
    updateRoom(room.id, {
      status: "limpeza",
      guest: undefined, guestCpf: undefined,
      checkIn: undefined, checkOut: undefined,
    })
    clearConsumption(room.id)
    addAuditEntry({
      user: username || "sistema",
      action: "Check-out realizado",
      reference: `Quarto ${room.number}`,
    })
  }

  function handleRelease() {
    updateRoom(room.id, { status: "disponivel" })
    addAuditEntry({
      user: username || "sistema",
      action: "Quarto liberado (limpeza concluida)",
      reference: `Quarto ${room.number}`,
    })
  }

  function handleBlock(endDate: string, responsible: string, reason: string) {
    updateRoom(room.id, {
      status: "bloqueado",
      blockEndDate: endDate, blockResponsible: responsible, blockReason: reason,
    })
    addAuditEntry({
      user: username || "sistema",
      action: "Quarto bloqueado",
      reference: `Quarto ${room.number} - ${reason}`,
    })
    setBlockModalOpen(false)
  }

  function handleUnblock() {
    updateRoom(room.id, {
      status: "disponivel",
      blockEndDate: undefined, blockResponsible: undefined, blockReason: undefined,
    })
    addAuditEntry({
      user: username || "sistema",
      action: "Desbloqueio de quarto",
      reference: `Quarto ${room.number}`,
    })
    setBlockModalOpen(false)
  }

  return (
    <>
      <Card className={`group relative overflow-hidden transition-all duration-200 hover:shadow-md ${config.borderClass}`}>
        <div className={`absolute inset-x-0 top-0 h-1 ${config.accent}`} />

        {overdue && (
          <div className="absolute right-3 top-3 z-10">
            <Badge className="animate-pulse-alert gap-1 bg-destructive text-destructive-foreground border-transparent text-[10px]">
              <AlertTriangle className="size-3" />
              Atrasado
            </Badge>
          </div>
        )}

        <CardHeader className="pb-0 pt-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{room.number}</span>
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{room.type}</span>
            </div>
            {!overdue && (
              <Badge className={`${config.badgeClass} gap-1 text-[11px]`}>
                {config.icon}
                {config.label}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="py-0">
          {room.status === "ocupado" && room.guest && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg bg-secondary/60 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <User className="size-3.5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{room.guest}</span>
              </div>
              {room.checkOut && (
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {"Saida: "}
                    <span className="font-medium text-foreground">{formatDateBR(room.checkOut)}</span>
                    <span className={`ml-1.5 rounded px-1 py-0.5 text-[10px] font-medium ${
                      overdue ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"
                    }`}>
                      {daysUntil(room.checkOut)}
                    </span>
                  </span>
                </div>
              )}
              {consumptionTotal > 0 && (
                <div className="flex items-center gap-2">
                  <ShoppingCart className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {"Consumo: "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {consumptionTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {room.status === "disponivel" && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/5 px-3 py-2.5">
              <DoorOpen className="size-4 text-success" />
              <span className="text-sm text-success">Disponivel para reserva</span>
            </div>
          )}

          {room.status === "limpeza" && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-cleaning/5 px-3 py-2.5">
              <SprayCan className="size-4 text-cleaning" />
              <span className="text-sm text-cleaning">Aguardando limpeza</span>
            </div>
          )}

          {room.status === "bloqueado" && (
            <div className="mt-3 flex flex-col gap-1 rounded-lg bg-info/5 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Lock className="size-3.5 text-info" />
                <span className="text-sm font-medium text-info">{room.blockReason || "Bloqueado"}</span>
              </div>
              {room.blockEndDate && (
                <span className="text-xs text-muted-foreground">
                  {"Previsao: "}
                  <span className="font-medium text-foreground">{formatDateBR(room.blockEndDate)}</span>
                </span>
              )}
            </div>
          )}

          {/* Conditional action buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            {room.status === "disponivel" && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" onClick={() => setCheckinOpen(true)}>
                  <LogIn className="size-3.5" /> Check-in
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setBlockModalOpen(true)}>
                  <Lock className="size-3.5" />
                </Button>
              </>
            )}
            {room.status === "ocupado" && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" onClick={handleCheckOut}>
                  <LogOutIcon className="size-3.5" /> Check-out
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" onClick={() => setConsumptionOpen(true)}>
                  <ShoppingCart className="size-3.5" /> Consumo
                </Button>
              </>
            )}
            {room.status === "limpeza" && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" onClick={handleRelease}>
                <CheckCircle2 className="size-3.5" /> Liberar Quarto
              </Button>
            )}
            {room.status === "bloqueado" && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" onClick={() => setBlockModalOpen(true)}>
                <Eye className="size-3.5" /> Detalhes / Desbloquear
              </Button>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-0 pb-4 pt-0">
          <Separator className="mb-3 mt-3" />
          <MiniTimeline days={room.timeline} />
        </CardFooter>
      </Card>

      <BlockRoomModal
        room={room} open={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onConfirmBlock={handleBlock} onUnblock={handleUnblock}
      />
      <CheckinModal
        room={room} open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
      />
      <ConsumptionSheet
        room={room} open={consumptionOpen}
        onClose={() => setConsumptionOpen(false)}
      />
    </>
  )
}
