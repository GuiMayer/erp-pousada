"use client"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useStockNavigation } from "@/contexts/active-tab-context"
import { roomPlan } from "@/lib/room-planning"
import type { Reservation, Room } from "@/lib/store"
import type { Stay } from "@/lib/stays"
import { BookingForm } from "./booking-form"
import { ReservationDetailsSheet } from "./reservation-details-sheet"
import { StaySheet } from "./stay-sheet"
import { MiniTimeline } from "./mini-timeline"
import { Card, CardHeader, CardContent, CardFooter } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"

type Task = { kind: "reserve" } | { kind: "reservation"; reservation: Reservation } | { kind: "stay"; stay: Stay } | { kind: "info" }
const date = (day: string) => day.split("-").reverse().join("/")

export function PlannedRoomCard({ room, selectedDate }: { room: Room; selectedDate: string }) {
  const { reservations = [], stays = [], getRoomTimeline } = useApp()
  const { can } = useAuth()
  const navigation = useStockNavigation()
  const plan = roomPlan(room, can("reservations.read") ? reservations : [], can("stays.read") ? stays : [], selectedDate)
  const [task, setTask] = useState<Task | null>(null), [busy, setBusy] = useState(false)
  const complete = can("reservations.read") && can("stays.read")
  const colors = !complete && plan.status === "disponivel" ? "bg-secondary text-secondary-foreground" : plan.blocked ? "bg-info text-info-foreground" : plan.status === "ocupado" ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"
  const label = !complete && plan.status === "disponivel" ? "Disponibilidade a confirmar" : plan.blocked ? "Bloqueado" : plan.ambiguous ? "Revisar previsão" : plan.reservations.length ? "Reservado" : plan.stays.length ? "Ocupação prevista" : "Livre previsto"
  const knownOccupant = [...plan.reservations.map(r => r.guestName), ...plan.stays.map(s => s.guestName)].join(", ")
  const consult = () => {
    if (!plan.blocked && !plan.ambiguous && plan.reservations.length === 1) setTask({ kind: "reservation", reservation: plan.reservations[0] })
    else if (!plan.blocked && !plan.ambiguous && plan.stays.length === 1) setTask({ kind: "stay", stay: structuredClone(plan.stays[0]) })
    else setTask({ kind: "info" })
  }
  return <>
    <Card className="mobile-room-card room-summary-card relative gap-0 overflow-hidden py-3 sm:h-full">
      <div className={`absolute inset-x-0 top-0 h-1 ${plan.blocked ? "bg-info" : plan.status === "ocupado" ? "bg-warning" : "bg-success"}`} />
      <CardHeader className="px-3 pb-0 pt-1"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="text-2xl font-bold">{room.number}</span><span className="ml-2 text-[10px] uppercase text-muted-foreground">{room.type}</span></div><Badge className={colors}>{label}</Badge></div></CardHeader>
      <CardContent className="flex flex-1 flex-col px-3 py-0">
        <div className="my-2 flex-1 space-y-2 rounded-lg bg-secondary/60 p-2 text-sm"><p className="text-xs text-muted-foreground">Previsão para {date(selectedDate)}</p><p className="break-words">{plan.blocked ? room.blockReason || "Bloqueio vigente na data" : knownOccupant || (complete ? "Disponível para reserva nesta data" : "A disponibilidade será validada ao confirmar a reserva")}</p>{plan.ambiguous && <p className="text-xs text-destructive">Há sobreposição no planejamento. Revise antes de reservar.</p>}{plan.blocked && <p className="text-xs text-muted-foreground">{room.blockEndDate ? `Previsão de liberação: ${date(room.blockEndDate)}` : "Sem previsão de liberação"}</p>}</div>
        <div className="flex min-h-11 gap-2">
          {plan.status === "disponivel" && can("reservations.create") && <Button variant="outline" className="min-h-11 flex-1" onClick={() => setTask({ kind: "reserve" })}>Reservar</Button>}
          {plan.status !== "disponivel" && <Button variant="outline" className="min-h-11 flex-1" onClick={consult}>{plan.blocked ? "Ver bloqueio" : plan.ambiguous ? "Ver planejamento" : plan.reservations.length ? "Ver reserva" : "Ver hospedagem"}</Button>}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch px-3 pb-0 pt-0"><Separator className="my-3" /><MiniTimeline days={getRoomTimeline(room.id, selectedDate, 7)} highlightDate={selectedDate} /></CardFooter>
    </Card>
    {task?.kind === "reserve" && <Dialog open onOpenChange={open => { if (!open && !busy) setTask(null) }}><DialogContent mobileTask protectDraft busy={busy} className="sm:max-w-xl"><DialogHeader><DialogTitle>Reserva · Quarto {room.number}</DialogTitle><DialogDescription>Entrada prevista em {date(selectedDate)}. Revise a pessoa, o período e o preço.</DialogDescription></DialogHeader><BookingForm intent="reservation" room={room} initialArrival={selectedDate} onBusy={setBusy} onDone={() => setTask(null)} /></DialogContent></Dialog>}
    {task?.kind === "reservation" && <ReservationDetailsSheet reservation={task.reservation} onClose={() => setTask(null)}>{navigation && can("reservations.read") && <Button variant="outline" onClick={() => navigation.setActiveTab("reservas")}>Gerenciar em Reservas</Button>}</ReservationDetailsSheet>}
    {task?.kind === "stay" && <StaySheet stay={task.stay} readOnly onClose={() => setTask(null)} />}
    {task?.kind === "info" && <Dialog open onOpenChange={open => { if (!open) setTask(null) }}><DialogContent mobileTask><DialogHeader><DialogTitle>Planejamento · Quarto {room.number}</DialogTitle><DialogDescription>{date(selectedDate)} · {label}</DialogDescription></DialogHeader>{plan.blocked && <p>{room.blockReason || "Bloqueio sem motivo informado"} · {room.blockEndDate ? `Até ${date(room.blockEndDate)}` : "Sem previsão de liberação"}. Bloqueios são alterados no atendimento atual.</p>}{plan.reservations.map(r => <Button key={r.id} variant="outline" onClick={() => setTask({ kind: "reservation", reservation: r })}>Reserva de {r.guestName}</Button>)}{plan.stays.map(s => <Button key={s.id} variant="outline" onClick={() => setTask({ kind: "stay", stay: structuredClone(s) })}>Hospedagem de {s.guestName}</Button>)}<Button variant="outline" onClick={() => setTask(null)}>Fechar</Button></DialogContent></Dialog>}
  </>
}
