"use client"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { businessDay } from "@/lib/utils/business-values"
import type { Reservation, Room } from "@/lib/store"
import { BookingForm } from "./booking-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Button } from "./ui/button"

export function CheckinModal({ room, open, onClose, reservation }: { room: Room; open: boolean; onClose: () => void; reservation?: Reservation }) {
  const { reservations } = useApp()
  const [busy, setBusy] = useState(false)
  const [chosen, setChosen] = useState<Reservation | null>(null)
  const eligible = reservations.filter(r => r.roomId === room.id && r.status === "confirmada" && r.checkIn <= businessDay())
  const expected = reservation ?? chosen ?? (eligible.length === 1 ? eligible[0] : undefined)
  return <Dialog open={open} onOpenChange={v => { if (!v && !busy) { setChosen(null); onClose() } }}><DialogContent mobileTask protectDraft busy={busy} className="sm:max-w-xl"><DialogHeader><DialogTitle>{expected ? "Atendimento da reserva" : `Check-in · Quarto ${room.number}`}</DialogTitle><DialogDescription>{expected ? "Revise as condições e a chegada efetiva antes de confirmar." : "Selecione a pessoa, a saída e confirme a entrada."}</DialogDescription></DialogHeader>
    {open && !expected && eligible.length > 1 ? <div className="space-y-3"><p>Escolha a reserva que será atendida:</p>{eligible.map(r => <Button key={r.id} variant="outline" className="h-auto w-full whitespace-normal" onClick={() => setChosen(r)}>{r.guestName} · {r.checkIn} a {r.checkOut}</Button>)}</div> : open && <BookingForm key={expected?.id ?? "new"} intent="checkin" room={room} reservation={expected} onBusy={setBusy} onDone={() => { setChosen(null); onClose() }} />}
  </DialogContent></Dialog>
}
