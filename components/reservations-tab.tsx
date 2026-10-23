"use client"
import { useMemo, useState, useEffect } from "react"
import { useTaskState } from "@/contexts/task-drafts-context"
import { reservationWorklist, emptyReservationFilters, type ReservationFilters } from "@/lib/reservation-worklist"
import { PageHeader } from "./page-header"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { DateField } from "./ui/date-field"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { businessDay } from "@/lib/utils/business-values"
import { reservationAmounts } from "@/lib/reservation-amounts"
import { type PendingReservationGroup } from "@/lib/reservation-groups"
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
  const { reservations, rooms, systemSettings, customers } = useApp()
  const { can } = useAuth()
  const [form, setForm] = useState<"new" | Reservation | null>(null)
  const [busy, setBusy] = useState(false)
  const [entry, setEntry] = useState<Reservation | null>(null)
  const [cancel, setCancel] = useState<{ reservation: Reservation; noShow: boolean } | null>(null)
  const [discount, setDiscount] = useState<Reservation | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [groupKey, setGroupKey] = useState<string | null>(null)
  const [filters, setFilters] = useTaskState<ReservationFilters>("reservations.filters", emptyReservationFilters, false)
  const [page, setPage] = useTaskState("reservations.page", 1, false)
  const today = businessDay()
  const list = useMemo(() => reservationWorklist(reservations, can("customers.read") ? customers : [], filters, today, page), [reservations, customers, filters, today, page, can])
  useEffect(() => { if (page !== list.page) setPage(list.page) }, [page, list.page, setPage])
  const updateFilter = (patch: Partial<ReservationFilters>) => { setFilters(previous => ({ ...previous, ...patch })); setPage(1) }
  const activeFilters = filters.query || filters.arrival !== "all" || filters.from || filters.until
  const groups = list.groups
  const pendingReservations = list.allGroups.flatMap(group => group.pending)
  const group = list.allGroups.find(group => group.key === groupKey)
  const closeDetails = () => { setDetailId(null); setGroupKey(null) }
  const openGroup = (group: PendingReservationGroup) => { if (group.isGroup) setGroupKey(group.key); else setDetailId(group.pending[0].id) }
  const period = (records: Reservation[], field: "checkIn" | "checkOut") => {
    const dates = [...new Set(records.map(r => r[field]))]
    return dates.length === 1 ? date(dates[0]) : "Datas variadas"
  }
  const detail = pendingReservations.find(r => r.id === detailId)
  const entryEligible = (r: Reservation) => r.status === "confirmada" && r.checkIn <= today && can("hospitality.checkin")
  const cancelEligible = (r: Reservation) => r.status === "confirmada" && can("reservations.cancel")
  const entryRoom = rooms.find(r => r.id === entry?.roomId)
  function actions(r: Reservation) {
    const mayDiscount = r.status === "confirmada" && can("reservations.discount")
    const mayEdit = r.status === "confirmada" && can("reservations.edit")
    const mayCancel = cancelEligible(r)
    const mayMarkAbsent = mayCancel && noShowEligible(r.checkIn, systemSettings.checkInTime)
    return <div className="flex flex-wrap items-center justify-end gap-2" onClick={event => event.stopPropagation()}>
      {entryEligible(r) && <Button size="sm" aria-label={`Fazer check-in de ${r.guestName} no quarto ${r.roomNumber}`} onClick={() => { setEntry(r); closeDetails() }}>Check-in</Button>}
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
  if (!can("reservations.read")) return <p role="status">Você não tem permissão para consultar reservas.</p>
  return <div className="space-y-4">
    <PageHeader title="Reservas" actions={can("reservations.create") && <Button size="sm" onClick={() => setForm("new")}>Nova reserva</Button>} />
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="reservation-search">Buscar reserva</Label><Input id="reservation-search" placeholder="Hóspede, empresa, quarto ou referência" value={filters.query} onChange={e => updateFilter({query:e.target.value})} /></div>
      <div className="space-y-2"><Label htmlFor="reservation-arrival">Chegadas</Label><select id="reservation-arrival" className="min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={filters.arrival} onChange={e => updateFilter({arrival:e.target.value as ReservationFilters["arrival"]})}><option value="all">Todas as chegadas</option><option value="today">Hoje</option><option value="next">Próximos 7 dias</option><option value="late">Chegada pendente em atraso</option></select></div>
      <div className="space-y-2"><Label htmlFor="reservation-from">Entrada a partir de</Label><DateField id="reservation-from" aria-label="Entrada a partir de" value={filters.from} onValueChange={from => updateFilter({from})} /></div>
      <div className="space-y-2"><Label htmlFor="reservation-until">Entrada até</Label><DateField id="reservation-until" aria-label="Entrada até" value={filters.until} onValueChange={until => updateFilter({until})} /></div>
    </div>
    {list.invalidPeriod && <p role="alert" className="text-sm text-destructive">A data final deve ser igual ou posterior à data inicial.</p>}
    <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-sm text-muted-foreground">{list.matchingCount} de {list.pendingCount} reservas aguardando chegada · {list.groupCount} atendimentos{activeFilters ? " no filtro" : ""}</p>{activeFilters && <Button variant="ghost" size="sm" onClick={() => {setFilters(emptyReservationFilters); setPage(1)}}>Limpar filtros</Button>}</div>
    <Card><CardContent className="p-0"><Table mobilePreview={["Hóspede", "Quarto", "Entrada", "Saída", "Status"]} mobileColumns={["Hóspede", "Quarto", "Entrada", "Saída", "Valor", "Status", "Ações"]}><TableHeader><TableRow>{["Hóspede", "Quarto", "Entrada", "Saída", "Valor", "Status", "Ações"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>
      {groups.map(group => {
        const first = group.pending[0]
        const amounts = reservationAmounts(group.pending)
        const payerNames = can("customers.read") ? [...new Set(group.pending.map(r => customers.find(c => c.id === r.payerId && c.name !== r.guestName)?.name).filter(Boolean))].join(", ") : ""
        const names = [...new Set(group.pending.map(r => r.guestName))].join(", ")
        return <TableRow key={group.key} className="cursor-pointer" onClick={() => openGroup(group)}>
          <TableCell><Button variant="link" className="h-auto whitespace-normal px-0 text-left" onClick={event => {event.stopPropagation(); openGroup(group)}}>{names}</Button>{payerNames && <p className="text-xs text-muted-foreground">Pagador: {payerNames}</p>}<p className="break-all text-xs text-muted-foreground">Ref.: {first.groupId ?? first.id}</p>{group.isGroup && <p className="text-xs text-muted-foreground">Grupo · {group.pending.length} de {group.members.length} aguardando</p>}{group.outsideCount > 0 && <p className="text-xs text-muted-foreground">{group.matchingIds.length} de {group.pending.length} quartos correspondem ao filtro; exibindo o grupo inteiro. No filtro: {group.pending.filter(r => list.matchingIds.has(r.id)).map(r => r.roomNumber).join(", ")}.</p>}</TableCell>
          <TableCell className="whitespace-normal">{group.roomNumbers}</TableCell>
          <TableCell>{period(group.pending, "checkIn")}</TableCell><TableCell>{period(group.pending, "checkOut")}</TableCell>
          <TableCell><span>Total: {formatCurrency(amounts.total)}</span><p className="text-xs text-muted-foreground">Recebido: {formatCurrency(amounts.received)} · Saldo: {formatCurrency(amounts.balance)}</p></TableCell><TableCell><Badge variant="secondary" className={group.pending.every(r => r.checkIn < today) ? "bg-warning/15 text-amber-900 dark:text-warning" : undefined}>{group.pending.every(r => r.checkIn < today) ? "Chegada em atraso" : group.pending.every(r => r.checkIn === today) ? "Chega hoje" : labels.confirmada}</Badge></TableCell>
          <TableCell onClick={e => e.stopPropagation()}>{group.isGroup ? <Button size="sm" variant="outline" aria-label={`Abrir grupo dos quartos ${group.roomNumbers}`} onClick={() => openGroup(group)}>Abrir grupo</Button> : actions(first)}</TableCell>
        </TableRow>
      })}
      {!groups.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{list.pendingCount ? "Nenhuma reserva corresponde aos filtros." : "Nenhuma reserva aguardando chegada."}</TableCell></TableRow>}
    </TableBody></Table></CardContent></Card>
    {list.pageCount > 1 && <nav aria-label="Paginação das reservas" className="flex items-center justify-between gap-3"><Button variant="outline" disabled={list.page === 1} onClick={() => setPage(list.page - 1)}>Anterior</Button><span className="text-sm">Página {list.page} de {list.pageCount}</span><Button variant="outline" disabled={list.page === list.pageCount} onClick={() => setPage(list.page + 1)}>Próxima</Button></nav>}
    <Dialog open={!!form} onOpenChange={v => { if (!v && !busy) setForm(null) }}><DialogContent mobileTask protectDraft busy={busy} className="sm:max-w-xl"><DialogHeader><DialogTitle>{form === "new" ? "Nova reserva" : "Editar reserva"}</DialogTitle><DialogDescription>Escolha o hóspede e revise período, quarto, ocupação e preço.</DialogDescription></DialogHeader>{form && <BookingForm key={form === "new" ? "new" : form.id} intent={form === "new" ? "reservation" : "edit"} reservation={form === "new" ? undefined : form} onBusy={setBusy} onDone={() => setForm(null)} />}</DialogContent></Dialog>
    {entry && entryRoom && <CheckinModal room={entryRoom} reservation={entry} open onClose={() => setEntry(null)} />}
    {discount && <ReservationDiscountDialog reservation={discount} onClose={() => setDiscount(null)} />}
    {cancel && <ReservationCancellationDialog reservation={cancel.reservation} noShow={cancel.noShow} onClose={() => setCancel(null)} />}
    {group && <ReservationGroupSheet matchingIds={activeFilters ? list.matchingIds : undefined} group={group} onClose={closeDetails} actions={actions} />}
    {detail && <ReservationDetailsSheet reservation={detail} onClose={() => setDetailId(null)}>{actions(detail)}</ReservationDetailsSheet>}
  </div>
}

