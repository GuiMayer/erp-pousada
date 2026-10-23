"use client"
import { ReservationContact } from "./reservation-contact"
import type { ReactNode } from "react"
import type { Reservation } from "@/lib/store"
import type { PendingReservationGroup } from "@/lib/reservation-groups"
import { reservationAmounts } from "@/lib/reservation-amounts"
import { formatCurrency } from "@/lib/utils/formatters"
import { ReservationDetails, reservationLabels } from "./reservation-details-sheet"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet"
import { Badge } from "./ui/badge"

const date = (value: string) => value.split("-").reverse().join("/")

export function ReservationGroupSheet({ group, matchingIds, onClose, actions }: { matchingIds?: ReadonlySet<string>; group: PendingReservationGroup; onClose: () => void; actions: (reservation: Reservation) => ReactNode }) {
  return <Sheet open onOpenChange={open => { if (!open) onClose() }}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
      <SheetHeader>
        <SheetTitle>Reserva de vários quartos</SheetTitle>
        <SheetDescription>Quartos {group.members.map(r => r.roomNumber).join(", ")} · {group.pending.length} de {group.members.length} aguardando chegada. Cada quarto é atendido separadamente.</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-4">
        <p className="text-sm">Valor dos quartos aguardando chegada: <strong>{formatCurrency(group.totalValue)}</strong></p>
        {matchingIds && <p role="note" className="text-sm text-muted-foreground">{group.pending.filter(r => matchingIds.has(r.id)).length} de {group.pending.length} quartos correspondem ao filtro. O grupo inteiro está disponível para atendimento individual.</p>}
        {group.members.map(r => <section key={r.id} aria-label={`Reserva do quarto ${r.roomNumber}`} className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Quarto {r.roomNumber}</h3><Badge variant={["cancelada", "noshow"].includes(r.status) ? "destructive" : "secondary"}>{reservationLabels[r.status]}</Badge></div>
          <div className="space-y-1 text-sm"><p className="font-medium">{r.guestName}</p><p className="break-all text-xs text-muted-foreground">Ref.: {r.id}</p>{matchingIds && r.status === "confirmada" && !matchingIds.has(r.id) && <p className="text-sm text-muted-foreground">Fora do filtro atual</p>}<p>Entrada: {date(r.checkIn)} · Saída: {date(r.checkOut)}</p><p>Contratado: {formatCurrency(r.totalValue)} · Recebido: {formatCurrency(reservationAmounts([r]).received)} · Saldo: {formatCurrency(reservationAmounts([r]).balance)}</p></div>
          <ReservationContact reservation={r} />
          {r.status === "confirmada" ? actions(r) : <p className="text-sm text-muted-foreground">{r.status === "checkin" ? "Hospedagem em andamento. Continue o atendimento pelo Mapa." : "Atendimento concluído. Consulte os detalhes no Histórico."}</p>}
          <details><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Dados da reserva do quarto {r.roomNumber}</summary><ReservationDetails reservation={r} showContact={false} /></details>
        </section>)}
      </div>
    </SheetContent>
  </Sheet>
}
