"use client"
import { DateField } from "@/components/ui/date-field"
import { PageHeader } from "./page-header"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { stayBalance, type Stay } from "@/lib/stays"
import type { Reservation } from "@/lib/store"
import { formatCurrency } from "@/lib/utils/formatters"
import { StaySheet } from "./stay-sheet"
import { ReservationDetailsSheet, reservationLabels } from "./reservation-details-sheet"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Card, CardContent } from "./ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"

type HistoryEntry = { key: string; guestName: string; payerId?: string | null; reservationId: string; checkIn: string; checkOut: string; status: string; roomNumber: string; stay?: Stay; reservation?: Reservation }
const date = (value: string) => value.split("-").reverse().join("/")
const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")

export function HistoryTab() {
  const { stays = [], reservations = [], customers = [], rooms = [] } = useApp()
  const { can } = useAuth()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [from, setFrom] = useState("")
  const [until, setUntil] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const mayReadStays = can("stays.read"), mayReadReservations = can("reservations.read")
  const entries: HistoryEntry[] = [
    ...(mayReadStays ? stays.filter(s => s.status === "closed").map(stay => ({ key: `stay:${stay.id}`, guestName: stay.guestName, payerId: stay.payerId, reservationId: stay.reservationId, checkIn: stay.checkIn, checkOut: stay.checkOut, status: "checkout", roomNumber: rooms.find(r => r.id === stay.roomId)?.number ?? String(stay.roomId), stay })) : []),
    ...(mayReadReservations ? reservations.filter(r => ["checkout", "cancelada", "noshow"].includes(r.status) && !(mayReadStays && stays.some(s => s.reservationId === r.id))).map(reservation => ({ key: `reservation:${reservation.id}`, guestName: reservation.guestName, payerId: reservation.payerId, reservationId: reservation.id, checkIn: reservation.checkIn, checkOut: reservation.checkOut, status: reservation.status, roomNumber: reservation.roomNumber, reservation })) : []),
  ].sort((a, b) => b.checkIn.localeCompare(a.checkIn) || a.key.localeCompare(b.key))
  const invalidPeriod = !!from && !!until && from > until
  const filtered = entries.filter(e => !invalidPeriod && (status === "all" || e.status === status) && (!from || e.checkIn >= from) && (!until || e.checkIn <= until) && searchable(`${e.guestName} ${e.reservationId} ${e.roomNumber} ${customers.find(c => c.id === e.payerId)?.name ?? ""}`).includes(searchable(query.trim())))
  const detail = entries.find(e => e.key === selected)

  if (!can("history.read") || !(mayReadStays || mayReadReservations)) return <p role="status">Você não tem permissão para consultar o histórico.</p>
  return <div className="space-y-4">
    <PageHeader title="Histórico" description="Consulte hospedagens encerradas, cancelamentos e ausências. Cobranças pendentes ficam no Financeiro." />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Label className="flex-col items-stretch gap-2">Buscar no histórico<Input placeholder="Hóspede, empresa, quarto ou reserva" value={query} onChange={e => setQuery(e.target.value)} /></Label>
      <Label className="flex-col items-stretch gap-2">Situação<select className="min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todas</option><option value="checkout">Encerradas</option><option value="cancelada">Canceladas</option><option value="noshow">Ausências</option></select></Label>
      <div className="min-w-0 space-y-2"><Label htmlFor="history-from" className="flex-col items-stretch gap-2">Entrada a partir de</Label><DateField aria-label="Entrada a partir de" id="history-from"  value={from} onValueChange={value => setFrom(value)} /></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="history-until" className="flex-col items-stretch gap-2">Entrada até</Label><DateField aria-label="Entrada até" id="history-until"  value={until} onValueChange={value => setUntil(value)} /></div>
    </div>
    {invalidPeriod && <p role="alert" className="text-sm text-destructive">A data final deve ser igual ou posterior à data inicial.</p>}
    {(query || status !== "all" || from || until) && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setStatus("all"); setFrom(""); setUntil("") }}>Limpar filtros</Button>}
    <Card><CardContent className="p-0"><Table mobilePreview={["Hóspede", "Quarto", "Entrada", "Situação"]} mobileColumns={["Hóspede", "Quarto", "Entrada", "Saída", "Situação", "Saldo", "Ações"]}>
      <TableHeader><TableRow>{["Hóspede", "Quarto", "Entrada", "Saída", "Situação", "Saldo", "Ações"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{filtered.map(e => <TableRow key={e.key}>
        <TableCell><span className="font-medium">{e.guestName}</span>{customers.find(c => c.id === e.payerId)?.name && customers.find(c => c.id === e.payerId)?.name !== e.guestName && <p className="text-xs text-muted-foreground">{customers.find(c => c.id === e.payerId)!.name}</p>}</TableCell>
        <TableCell>{e.roomNumber}</TableCell><TableCell>{date(e.checkIn)}</TableCell><TableCell>{date(e.checkOut)}</TableCell>
        <TableCell><Badge variant={e.status === "checkout" ? "secondary" : "destructive"}>{reservationLabels[e.status as Reservation["status"]]}</Badge></TableCell>
        <TableCell>{e.status !== "checkout" ? "—" : e.stay ? formatCurrency(stayBalance(e.stay).balance) : "Consulte a reserva"}</TableCell>
        <TableCell><Button size="sm" variant="outline" aria-label={`Ver detalhes de ${e.guestName}`} onClick={() => setSelected(e.key)}>{e.stay ? "Abrir extrato" : "Abrir reserva"}</Button></TableCell>
      </TableRow>)}{!filtered.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum registro encontrado no histórico.</TableCell></TableRow>}</TableBody>
    </Table></CardContent></Card>
    {detail?.stay && <StaySheet key={detail.key} stay={detail.stay} readOnly onClose={() => setSelected(null)} />}
    {detail?.reservation && <ReservationDetailsSheet reservation={detail.reservation} onClose={() => setSelected(null)} />}
  </div>
}
