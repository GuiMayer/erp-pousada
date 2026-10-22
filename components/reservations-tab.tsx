"use client"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { businessDay } from "@/lib/utils/business-values"
import { reservationAmounts } from "@/lib/reservation-amounts"
import { pendingReservationGroups, type PendingReservationGroup } from "@/lib/reservation-groups"
import { ReservationGroupSheet } from "./reservation-group-sheet"
import { noShowEligible } from "@/lib/booking-flow"
import { formatCurrency } from "@/lib/utils/formatters"
import type { Reservation } from "@/lib/store"
import { BookingForm } from "./booking-form"
import { CheckinModal } from "./checkin-modal"
import { ReservationCancellationDialog } from "./reservation-cancellation-dialog"
import { ReservationDiscountDialog } from "./reservation-discount-dialog"
import { ReservationPaymentButton } from "./reservation-payment-button"
import { ReservationDetailsSheet, reservationLabels as labels } from "./reservation-details-sheet"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Card, CardContent } from "./ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "./ui/dropdown-menu"
import { MoreHorizontal, Pencil, XCircle, UserX } from "lucide-react"
const date = (value: string) => value.split("-").reverse().join("/")

export function ReservationsTab() {
  const { reservations, rooms, systemSettings } = useApp()
  const { can } = useAuth()
  const [form, setForm] = useState<"new" | Reservation | null>(null)
  const [busy, setBusy] = useState(false)
  const [entry, setEntry] = useState<Reservation | null>(null)
  const [cancel, setCancel] = useState<{ reservation: Reservation; noShow: boolean } | null>(null)
  const [discount, setDiscount] = useState<Reservation | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [groupKey, setGroupKey] = useState<string | null>(null)
  const groups = pendingReservationGroups(reservations)
  const pendingReservations = groups.flatMap(group => group.pending)
  const group = groups.find(group => group.key === groupKey)
  const closeDetails = () => { setDetailId(null); setGroupKey(null) }
  const openGroup = (group: PendingReservationGroup) => { if (group.isGroup) setGroupKey(group.key); else setDetailId(group.pending[0].id) }
  const period = (records: Reservation[], field: "checkIn" | "checkOut") => {
    const dates = [...new Set(records.map(r => r[field]))]
    return dates.length === 1 ? date(dates[0]) : "Datas variadas"
  }
  const detail = pendingReservations.find(r => r.id === detailId)
  const entryEligible = (r: Reservation) => r.status === "confirmada" && r.checkIn <= businessDay() && can("hospitality.checkin")
  const cancelEligible = (r: Reservation) => r.status === "confirmada" && can("reservations.cancel")
  const entryRoom = rooms.find(r => r.id === entry?.roomId)
  function actions(r: Reservation) {
    const mayDiscount = r.status === "confirmada" && can("reservations.discount")
    const mayEdit = r.status === "confirmada" && can("reservations.edit")
    const mayCancel = cancelEligible(r)
    const mayMarkAbsent = mayCancel && noShowEligible(r.checkIn, systemSettings.checkInTime)
    return <div className="flex flex-wrap items-center justify-end gap-2" onClick={event => event.stopPropagation()}>
      {entryEligible(r) && <Button size="sm" onClick={() => { setEntry(r); closeDetails() }}>Fazer check-in</Button>}
      <ReservationPaymentButton reservation={r} />
      {(mayEdit || mayCancel || mayDiscount) && <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-11 shrink-0 sm:size-9" aria-label={`Mais ações da reserva ${r.id}`} title="Mais ações"><MoreHorizontal className="size-4" aria-hidden="true" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Quarto {r.roomNumber} · Reserva</DropdownMenuLabel>
          {mayEdit && <DropdownMenuItem onSelect={() => { setForm(r); closeDetails() }}><Pencil className="size-4" />Editar reserva</DropdownMenuItem>}
          {mayDiscount && <DropdownMenuItem onSelect={() => { setDiscount(r); closeDetails() }}>Aplicar desconto</DropdownMenuItem>}
          {mayMarkAbsent && <DropdownMenuItem onSelect={() => { setCancel({reservation:r,noShow:true}); closeDetails() }}><UserX className="size-4" />Registrar ausência</DropdownMenuItem>}
          {mayCancel && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => { setCancel({reservation:r,noShow:false}); closeDetails() }}><XCircle className="size-4" />Cancelar reserva</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>}
    </div>
  }
  return <div className="space-y-6 animate-fade-in">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Reservas</h2>{can("reservations.create") && <Button size="sm" onClick={() => setForm("new")}>Nova Reserva</Button>}</div>
    <Card><CardContent className="p-0"><Table mobilePreview={["Hóspede", "Quarto", "Entrada", "Saída", "Status"]} mobileColumns={["Hóspede", "Quarto", "Entrada", "Saída", "Valor", "Status", "Ações"]}><TableHeader><TableRow>{["Hóspede", "Quarto", "Entrada", "Saída", "Valor", "Status", "Ações"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>
      {groups.map(group => {
        const first = group.pending[0]
        const amounts = reservationAmounts(group.pending)
        const names = [...new Set(group.pending.map(r => r.guestName))].join(", ")
        return <TableRow key={group.key} className="cursor-pointer" onClick={() => openGroup(group)}>
          <TableCell><Button variant="link" className="h-auto whitespace-normal px-0 text-left" onClick={() => openGroup(group)}>{names}</Button>{group.isGroup && <p className="text-xs text-muted-foreground">Grupo · {group.pending.length} de {group.members.length} aguardando</p>}</TableCell>
          <TableCell className="whitespace-normal">{group.roomNumbers}</TableCell>
          <TableCell>{period(group.pending, "checkIn")}</TableCell><TableCell>{period(group.pending, "checkOut")}</TableCell>
          <TableCell><span>Total: {formatCurrency(amounts.total)}</span><p className="text-xs text-muted-foreground">Recebido: {formatCurrency(amounts.received)} · Saldo: {formatCurrency(amounts.balance)}</p></TableCell><TableCell><Badge variant="secondary">{labels.confirmada}</Badge></TableCell>
          <TableCell onClick={e => e.stopPropagation()}>{group.isGroup ? <Button size="sm" variant="outline" aria-label={`Abrir grupo dos quartos ${group.roomNumbers}`} onClick={() => openGroup(group)}>Abrir grupo</Button> : actions(first)}</TableCell>
        </TableRow>
      })}
      {!pendingReservations.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma reserva aguardando chegada.</TableCell></TableRow>}
    </TableBody></Table></CardContent></Card>
    <Dialog open={!!form} onOpenChange={v => { if (!v && !busy) setForm(null) }}><DialogContent mobileTask protectDraft busy={busy} className="sm:max-w-xl"><DialogHeader><DialogTitle>{form === "new" ? "Nova reserva" : "Editar reserva"}</DialogTitle><DialogDescription>Escolha o hóspede e revise período, quarto, ocupação e preço.</DialogDescription></DialogHeader>{form && <BookingForm key={form === "new" ? "new" : form.id} intent={form === "new" ? "reservation" : "edit"} reservation={form === "new" ? undefined : form} onBusy={setBusy} onDone={() => setForm(null)} />}</DialogContent></Dialog>
    {entry && entryRoom && <CheckinModal room={entryRoom} reservation={entry} open onClose={() => setEntry(null)} />}
    {discount && <ReservationDiscountDialog reservation={discount} onClose={() => setDiscount(null)} />}
    {cancel && <ReservationCancellationDialog reservation={cancel.reservation} noShow={cancel.noShow} onClose={() => setCancel(null)} />}
    {group && <ReservationGroupSheet group={group} onClose={closeDetails} actions={actions} />}
    {detail && <ReservationDetailsSheet reservation={detail} onClose={() => setDetailId(null)}>{actions(detail)}</ReservationDetailsSheet>}
  </div>
}

