"use client"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { businessDay } from "@/lib/utils/business-values"
import { noShowEligible } from "@/lib/booking-flow"
import { formatCurrency } from "@/lib/utils/formatters"
import type { Reservation } from "@/lib/store"
import { BookingForm } from "./booking-form"
import { CheckinModal } from "./checkin-modal"
import { ReservationCancellationDialog } from "./reservation-cancellation-dialog"
import { ReservationPaymentButton } from "./reservation-payment-button"
import { StaysList } from "./stay-sheet"
import { LodgingQuotePreview } from "./lodging-quote-preview"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Card, CardContent } from "./ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
const labels = { confirmada: "Confirmada", checkin: "Hospedado", checkout: "Encerrada", cancelada: "Cancelada", noshow: "Ausência" }
const date = (value: string) => value.split("-").reverse().join("/")

export function ReservationsTab() {
  const { reservations, rooms, customers, systemSettings } = useApp()
  const { can } = useAuth()
  const [form, setForm] = useState<"new" | Reservation | null>(null)
  const [busy, setBusy] = useState(false)
  const [entry, setEntry] = useState<Reservation | null>(null)
  const [cancel, setCancel] = useState<{ reservation: Reservation; noShow: boolean } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = reservations.find(r => r.id === detailId)
  const entryEligible = (r: Reservation) => r.status === "confirmada" && r.checkIn <= businessDay() && can("hospitality.checkin")
  const cancelEligible = (r: Reservation) => r.status === "confirmada" && can("reservations.cancel")
  const entryRoom = rooms.find(r => r.id === entry?.roomId)
  function actions(r: Reservation) {
    return <div className="flex flex-wrap justify-end gap-1">
      {entryEligible(r) && <Button size="sm" onClick={() => { setEntry(r); setDetailId(null) }}>Fazer check-in</Button>}
      <ReservationPaymentButton reservation={r} />
      {r.status === "confirmada" && can("reservations.edit") && <Button size="sm" variant="outline" onClick={() => { setForm(r); setDetailId(null) }}>Editar</Button>}
      {cancelEligible(r) && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setCancel({ reservation: r, noShow: false }); setDetailId(null) }}>Cancelar</Button>}
      {cancelEligible(r) && noShowEligible(r.checkIn, systemSettings.checkInTime) && <Button size="sm" variant="ghost" onClick={() => { setCancel({ reservation: r, noShow: true }); setDetailId(null) }}>No-show</Button>}
    </div>
  }
  return <div className="space-y-6 animate-fade-in">
    <StaysList />
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Reservas</h2>{can("reservations.create") && <Button size="sm" onClick={() => setForm("new")}>Nova Reserva</Button>}</div>
    <Card><CardContent className="p-0"><Table mobilePreview={["Hóspede", "Quarto", "Entrada", "Saída", "Status"]} mobileColumns={["Hóspede", "Quarto", "Entrada", "Saída", "Valor", "Status", "Ações"]}><TableHeader><TableRow>{["Hóspede", "Quarto", "Entrada", "Saída", "Valor", "Status", "Ações"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>
      {reservations.map(r => <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetailId(r.id)}><TableCell><Button variant="link" className="h-auto px-0 text-left" onClick={() => setDetailId(r.id)}>{r.guestName}</Button></TableCell><TableCell>{r.roomNumber}</TableCell><TableCell>{date(r.checkIn)}</TableCell><TableCell>{date(r.checkOut)}</TableCell><TableCell>{formatCurrency(r.totalValue)}</TableCell><TableCell><Badge variant={r.status === "cancelada" || r.status === "noshow" ? "destructive" : "secondary"}>{labels[r.status]}</Badge></TableCell><TableCell onClick={e => e.stopPropagation()}>{actions(r)}</TableCell></TableRow>)}
      {!reservations.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma reserva cadastrada.</TableCell></TableRow>}
    </TableBody></Table></CardContent></Card>
    <Dialog open={!!form} onOpenChange={v => { if (!v && !busy) setForm(null) }}><DialogContent mobileTask protectDraft busy={busy} className="sm:max-w-xl"><DialogHeader><DialogTitle>{form === "new" ? "Nova reserva" : "Editar reserva"}</DialogTitle><DialogDescription>Escolha o hóspede e revise período, quarto, ocupação e preço.</DialogDescription></DialogHeader>{form && <BookingForm key={form === "new" ? "new" : form.id} intent={form === "new" ? "reservation" : "edit"} reservation={form === "new" ? undefined : form} onBusy={setBusy} onDone={() => setForm(null)} />}</DialogContent></Dialog>
    {entry && entryRoom && <CheckinModal room={entryRoom} reservation={entry} open onClose={() => setEntry(null)} />}
    {cancel && <ReservationCancellationDialog reservation={cancel.reservation} noShow={cancel.noShow} onClose={() => setCancel(null)} />}
    <Sheet open={!!detail} onOpenChange={v => { if (!v) setDetailId(null) }}><SheetContent className="overflow-y-auto sm:max-w-lg">{detail && <><SheetHeader><SheetTitle>Reserva · {detail.guestName}</SheetTitle><SheetDescription>Quarto {detail.roomNumber} · {labels[detail.status]}</SheetDescription></SheetHeader><div className="space-y-4 py-6 text-sm"><p>CPF: {detail.cpf}</p><p>Entrada prevista: {date(detail.checkIn)} · Saída: {date(detail.checkOut)}</p><p>Pessoas: {detail.guestCount ?? "Informe a ocupação"} · Responsável: {customers.find(c => c.id === detail.payerId)?.name ?? "Revise o pagador"}</p><p>Contratado: {formatCurrency(detail.totalValue)} · Recebido: {formatCurrency(detail.paidValue ?? 0)}</p>{detail.nightlyPrices && <details><summary className="cursor-pointer">Composição do preço contratado</summary><LodgingQuotePreview result={{ quote: { nights: detail.nightlyPrices, total: detail.nightlyPrices.reduce((s, n) => s + n.total, 0) } }} /></details>}{detail.priceExceptionReason && <p>Preço autorizado: {detail.priceExceptionReason}</p>}{["cancelada", "noshow"].includes(detail.status) && <section className="space-y-2 rounded border p-3"><p>Devolvido: {formatCurrency(detail.refundedValue ?? 0)} · Retido: {formatCurrency(detail.retainedValue ?? 0)} · Crédito: {formatCurrency(detail.cancelTreatment === "credito" ? (detail.cancellationReceivedValue ?? detail.paidValue ?? 0) - (detail.retainedValue ?? 0) : 0)}</p>{detail.cancellationReason && <p className="whitespace-pre-wrap break-words">Motivo do cancelamento: {detail.cancellationReason}</p>}{detail.cancellationFinancialReason && <p className="whitespace-pre-wrap break-words">Justificativa financeira: {detail.cancellationFinancialReason}</p>}{detail.cancelledAt && <p>Cancelado em {new Date(detail.cancelledAt).toLocaleString("pt-BR")} por {detail.cancelledBy}.</p>}</section>}{actions(detail)}</div></>}</SheetContent></Sheet>
  </div>
}

