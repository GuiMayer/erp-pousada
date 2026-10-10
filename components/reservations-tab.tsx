"use client"
import { StaysList } from "./stay-sheet"
import { CustomerCombobox } from "./customer-combobox"
import { suggestPayerId } from "@/lib/customer-company"
import type { Customer } from "@/lib/store"
import { normalizeDocument } from "@/lib/utils/cpf-cnpj-validator"
import { LodgingQuotePreview, previewLodging } from "./lodging-quote-preview"
import { PermissionGate } from "@/components/permission-gate"

import { useState, useMemo } from "react"
import { getDataConfig } from "@/lib/data/config"
import { businessDay } from "@/lib/utils/business-values"
import { ReservationPaymentButton } from "./reservation-payment-button"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import {
  Plus, XCircle, UserX, Search, User, BarChart3, AlertTriangle,
  Check, ChevronsUpDown, Pencil, Eye, CalendarDays, BedDouble, DollarSign,
} from "lucide-react"
import type { Reservation, GuestProfile, Room } from "@/lib/store"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/formatters"

const statusLabels: Record<Reservation["status"], string> = {
  confirmada: "Confirmada",
  checkin: "Check-in",
  checkout: "Check-out",
  cancelada: "Cancelada",
  noshow: "No-show",
}

const statusBadgeClass: Record<Reservation["status"], string> = {
  confirmada: "bg-success/15 text-success border-transparent",
  checkin: "bg-warning/15 text-warning-foreground border-transparent",
  checkout: "bg-secondary text-secondary-foreground border-transparent",
  cancelada: "bg-destructive/15 text-destructive border-transparent",
  noshow: "bg-destructive/15 text-destructive border-transparent",
}

function formatDateBR(iso: string) {
  const d = new Date(iso + "T12:00:00")
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

// Room Combobox component
function RoomCombobox({ rooms, value, onChange }: { rooms: Room[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const selected = rooms.find(r => String(r.id) === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline" role="combobox" aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? `${selected.number} - ${selected.type}` : "Selecione o quarto..."}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar quarto..." />
          <CommandList>
            <CommandEmpty>Nenhum quarto disponivel.</CommandEmpty>
            <CommandGroup>
              {rooms.map(room => (
                <CommandItem
                  key={room.id}
                  value={`${room.number} ${room.type}`}
                  onSelect={() => {
                    onChange(String(room.id))
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 size-4", value === String(room.id) ? "opacity-100" : "opacity-0")} />
                  <span className="font-bold tabular-nums">{room.number}</span>
                  <span className="ml-2 text-muted-foreground">{room.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function ReservationsTab() {
  const {
    customers, lodgingTariffs, runOperation, reservations, rooms, addReservation, updateReservation,
    findGuest, addAuditEntry,
  } = useApp()
  const { username, can } = useAuth()

  const [showNewForm, setShowNewForm] = useState(false)
  const [cancelModal, setCancelModal] = useState<Reservation | null>(null)
  const [cancelTreatment, setCancelTreatment] = useState<string>("")
  const [cancellationFee, setCancellationFee] = useState("0")
  const [noShow, setNoShow] = useState(false)
  const [pending, setPending] = useState(false)
  const [operationError, setOperationError] = useState("")
  const [detailSheet, setDetailSheet] = useState<Reservation | null>(null)
  const [editModal, setEditModal] = useState<Reservation | null>(null)

  // New reservation form state
  const [guestId, setGuestId] = useState("")
  const [payerId, setPayerId] = useState("")
  const [payerTouched, setPayerTouched] = useState(false)
  const [occupancies, setOccupancies] = useState<Record<string, number>>({})
  const [exception, setException] = useState(false)
  const [exceptionReason, setExceptionReason] = useState("")
  const [editReason, setEditReason] = useState("")
  const [newCpf, setNewCpf] = useState("")
  const [foundGuest, setFoundGuest] = useState<GuestProfile | undefined>()
  const [newGuestName, setNewGuestName] = useState("")
  const [newCheckIn, setNewCheckIn] = useState("")
  const [newCheckOut, setNewCheckOut] = useState("")
  const [newTotal, setNewTotal] = useState("")
  // Group reservations: multiple rooms
  const [selectedRooms, setSelectedRooms] = useState<string[]>([""])

  // Edit form
  const [editCheckIn, setEditCheckIn] = useState("")
  const [editCheckOut, setEditCheckOut] = useState("")
  const [editTotal, setEditTotal] = useState("")

  const availableRooms = rooms.filter(room => {
    if (!newCheckIn || !newCheckOut) return true
    if (room.status === "bloqueado" && (!room.blockEndDate || newCheckIn <= room.blockEndDate)) return false
    return !reservations.some(reservation => reservation.roomId === room.id && ["confirmada", "checkin"].includes(reservation.status) && reservation.checkIn < newCheckOut && reservation.checkOut > newCheckIn)
  })

  function handleCpfSearch(cpf: string, selected?: Customer) {
    setNewCpf(cpf)
    const guest = findGuest(cpf)
    const document = normalizeDocument(cpf)
    const person = selected ?? (document ? customers.find(c => normalizeDocument(c.cpfCnpj) === document || c.id === guest?.customerId) : undefined)
    setGuestId(person?.id ?? "")
    if (!payerTouched) setPayerId(suggestPayerId(person, customers))
    if (cpf.length >= 11) {
      setFoundGuest(guest)
      if (person || guest) setNewGuestName(person?.name ?? guest!.name)
    } else {
      setFoundGuest(undefined)
    }
  }

  async function handleCreateReservation() {
    if (pending || !newCpf || !newGuestName || !newCheckIn || !newCheckOut) return
    const chosen = selectedRooms.filter(Boolean).map(value => Number(value))
    if (!chosen.length) return
    setPending(true); setOperationError("")
    try {
      const prices = chosen.map(roomId => {
        const room = rooms.find(r => r.id === roomId)!, guestCount = occupancies[String(roomId)] ?? 1
        if (!room.capacity || guestCount > room.capacity) throw new Error('Configure a capacidade do quarto e respeite sua lotação')
        const result = previewLodging(room, lodgingTariffs, guestCount, newCheckIn, newCheckOut)
        if (!exception && !result.quote) throw new Error(result.error || 'Informe o período')
        if (exception && (!can('lodgingTariffs.override') || exceptionReason.trim().length < 5)) throw new Error('Preço excepcional exige permissão e motivo de pelo menos 5 caracteres')
        return { roomId, guestCount, totalValue: exception ? Number(newTotal) : result.quote!.total, priceExceptionReason: exception ? exceptionReason : undefined, nightlyPrices: result.quote?.nights }
      })
      if (getDataConfig().adapter === "database") await runOperation("reserve-group", { payerId: payerId || guestId || undefined, rooms: prices.map(({ nightlyPrices: _prices, ...p }) => p), cpf: newCpf, guestName: newGuestName, checkIn: newCheckIn, checkOut: newCheckOut })
      else for (const price of prices) {
        const { roomId, ...pricing } = price
        const room = rooms.find(item => item.id === roomId)!
        await addReservation({ id: crypto.randomUUID(), roomId, roomNumber: room.number, cpf: newCpf, guestName: newGuestName, checkIn: newCheckIn, checkOut: newCheckOut, ...pricing, payerId: payerId || guestId, status: "confirmada" })
      }
      setGuestId(""); setPayerId(""); setPayerTouched(false); setException(false); setExceptionReason(""); setOccupancies({}); setNewCpf(""); setFoundGuest(undefined); setNewGuestName(""); setSelectedRooms([""]); setNewCheckIn(""); setNewCheckOut(""); setNewTotal(""); setShowNewForm(false)
    } catch (error) { setOperationError(error instanceof Error ? error.message : "Reserva não concluída") }
    finally { setPending(false) }
  }

  function handleAddRoomSlot() {
    setSelectedRooms(prev => [...prev, ""])
  }

  function handleRoomChange(index: number, value: string) {
    setSelectedRooms(prev => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }

  function handleRemoveRoomSlot(index: number) {
    setSelectedRooms(prev => prev.filter((_, i) => i !== index))
  }

  async function handleCancel() {
    if (!cancelModal || !cancelTreatment || pending) return
    setPending(true); setOperationError("")
    try {
      if (getDataConfig().adapter === "database") await runOperation("cancel-reservation", { reservationId: cancelModal.id, status: noShow ? "noshow" : "cancelada", treatment: cancelTreatment, fee: cancelTreatment === "estorno" ? 0 : Number(cancellationFee) || 0 })
      else { await updateReservation(cancelModal.id, { status: noShow ? "noshow" : "cancelada", cancelTreatment: cancelTreatment as "estorno" | "multa" | "credito" }); await addAuditEntry({ user: username || "sistema", action: "Reserva cancelada", reference: cancelModal.id }) }
      setCancelModal(null); setCancelTreatment(""); setCancellationFee("0"); setNoShow(false)
    } catch (error) { setOperationError(error instanceof Error ? error.message : "Cancelamento não concluído") }
    finally { setPending(false) }
  }

  function handleNoShow(reservation: Reservation) {
    if (reservation.checkIn > businessDay()) { setOperationError("No-show só pode ser registrado a partir da chegada prevista"); return }
    setNoShow(true); setCancelTreatment("multa"); setCancellationFee("0"); setCancelModal(reservation)
  }

  function openEdit(r: Reservation) {
    setEditModal(r)
    setEditReason("")
    setEditCheckIn(r.checkIn)
    setEditCheckOut(r.checkOut)
    setEditTotal(String(r.totalValue))
  }

  async function handleSaveEdit() {
    if (!editModal || pending) return
    setPending(true); setOperationError("")
    try { await updateReservation(editModal.id, { recordVersion: editModal.recordVersion, checkIn: editCheckIn, checkOut: editCheckOut, totalValue: Number(editTotal) || 0, priceExceptionReason: editReason || undefined }); setEditModal(null) }
    catch (error) { setOperationError(error instanceof Error ? error.message : "Edição não concluída") }
    finally { setPending(false) }
  }

  const isCheckInOverdue = (r: Reservation) => {
    if (r.status !== "confirmada") return false
    const now = new Date()
    const checkin = new Date(r.checkIn + "T14:00:00")
    return now > checkin
  }

  // Rooms already selected in other slots
  const usedRoomIds = new Set(selectedRooms.filter(Boolean))

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <StaysList />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-foreground">Reservas</h2>
        <PermissionGate permission="reservations.create"><Button size="sm" className="gap-1.5" onClick={() => setShowNewForm(!showNewForm)}>
          <Plus className="size-4" />
          Nova Reserva
        </Button></PermissionGate>
      </div>

      {operationError && <p role="alert" className="text-sm text-destructive">{operationError}</p>}
      {/* New reservation form */}
      {showNewForm && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold text-foreground">Nova Reserva</h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reservation-cpf">CPF do hóspede</Label>
                <div className="flex gap-2">
                  <Input id="reservation-cpf" inputMode="numeric" placeholder="000.000.000-00" value={newCpf} onChange={e => handleCpfSearch(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reservation-guest">Nome do hóspede</Label>
                <Input id="reservation-guest" value={newGuestName} onChange={e => setNewGuestName(e.target.value)} placeholder="Nome completo" />
              </div>
            </div>

            {foundGuest && (
              <div className="flex flex-wrap items-center gap-4 rounded-lg bg-secondary/60 px-4 py-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{foundGuest.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><BarChart3 className="size-3" />{foundGuest.totalStays} estadias</span>
                  <span>Ticket: {formatCurrency(foundGuest.avgTicket)}</span>
                  {foundGuest.noShows > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="size-3" />{foundGuest.noShows} no-show(s)
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Buscar ou cadastrar hóspede</Label><CustomerCombobox purpose="guest" value={guestId} onChange={(id, _name, selected) => { const person = selected ?? customers.find(c => c.id === id); if (person) handleCpfSearch(person.cpfCnpj, person) }} /></div>
              <div><Label>Quem paga a hospedagem?</Label><CustomerCombobox value={payerId} onChange={id => { setPayerTouched(true); setPayerId(id) }} /><p className="mt-1 text-xs text-muted-foreground">A empresa vinculada é sugerida; você pode escolher outro pagador. Cobrança empresarial após a saída entra na sprint 2.</p></div>
            </div>
            {/* Room selection with group support */}
            <div className="flex flex-col gap-3">
              <Label>Quartos</Label>
              {selectedRooms.map((roomId, index) => (
                <div key={index} className="flex flex-wrap items-start gap-2">
                  <div className="flex-1">
                    <RoomCombobox
                      rooms={availableRooms.filter(r => !usedRoomIds.has(String(r.id)) || String(r.id) === roomId)}
                      value={roomId}
                      onChange={(v) => handleRoomChange(index, v)}
                    />
                  </div>
                  <div className="w-28"><Label htmlFor={'occupancy-'+index}>Pessoas</Label><Input id={'occupancy-'+index} type="number" min={1} max={rooms.find(r => String(r.id) === roomId)?.capacity ?? 100} value={occupancies[roomId] ?? 1} onChange={e => setOccupancies({ ...occupancies, [roomId]: Number(e.target.value) })} /></div>
                  {roomId && <div className="w-full"><LodgingQuotePreview result={previewLodging(rooms.find(r => String(r.id) === roomId), lodgingTariffs, occupancies[roomId] ?? 1, newCheckIn, newCheckOut)} /></div>}
                  {selectedRooms.length > 1 && (
                    <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveRoomSlot(index)}>
                      <XCircle className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline" size="sm" className="gap-1.5 text-xs w-fit"
                onClick={handleAddRoomSlot}
                disabled={availableRooms.length <= selectedRooms.filter(Boolean).length}
              >
                <Plus className="size-3.5" /> Adicionar outro quarto
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reservation-start">Check-in</Label>
                <Input id="reservation-start" type="date" value={newCheckIn} onChange={e => setNewCheckIn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reservation-end">Check-out</Label>
                <Input id="reservation-end" type="date" value={newCheckOut} onChange={e => setNewCheckOut(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Preço</Label><p className="py-2 text-sm text-muted-foreground">Calculado pela tarifa de cada quarto.</p>
              </div>
            </div>

            {can('lodgingTariffs.override') && <div className="space-y-2 rounded-lg border p-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={exception} onChange={e => setException(e.target.checked)} />Usar preço excepcional autorizado</label>{exception && <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="exception-value">Total acordado por quarto (R$)</Label><Input id="exception-value" type="number" min={0} step="0.01" value={newTotal} onChange={e => setNewTotal(e.target.value)} /></div><div><Label htmlFor="exception-reason">Motivo</Label><Input id="exception-reason" value={exceptionReason} onChange={e => setExceptionReason(e.target.value)} /></div></div>}</div>}
            {selectedRooms.filter(Boolean).length > 1 && (
              <div className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
                Reserva de grupo: {selectedRooms.filter(Boolean).length} quartos selecionados
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowNewForm(false); setSelectedRooms([""]) }}>Cancelar</Button>
              <Button
                size="sm"
                disabled={!newCpf || !newGuestName || selectedRooms.filter(Boolean).length === 0 || !newCheckIn || !newCheckOut}
                onClick={handleCreateReservation}
              >
                Confirmar Reserva
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reservations table */}
      <Card>
        <CardContent className="p-0">
          <Table mobilePreview={["Hóspede", "Quarto", "Check-in", "Check-out", "Status"]} mobileColumns={["ID", "Hóspede", "Quarto", "Check-in", "Check-out", "Valor", "Status", "Ações"]}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Hospede</TableHead>
                <TableHead>Quarto</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setDetailSheet(r)}
                >
                  <TableCell className="font-mono text-xs">{r.id}</TableCell>
                  <TableCell className="font-medium">{r.guestName}</TableCell>
                  <TableCell>{r.roomNumber}</TableCell>
                  <TableCell className="text-xs">{formatDateBR(r.checkIn)}</TableCell>
                  <TableCell className="text-xs">{formatDateBR(r.checkOut)}</TableCell>
                  <TableCell className="text-xs tabular-nums">{formatCurrency(r.totalValue)}</TableCell>
                  <TableCell>
                    <Badge className={`${statusBadgeClass[r.status]} text-[11px]`}>
                      {statusLabels[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}><ReservationPaymentButton reservation={r} />
                    <div className="flex gap-1 justify-end">
                      {(r.status === "confirmada" || r.status === "checkin") && (
                        <>
                          <PermissionGate permission="reservations.edit"><Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => openEdit(r)}>
                            <Pencil className="size-3.5" /> Editar
                          </Button></PermissionGate>
                          <PermissionGate permission="reservations.cancel"><Button
                            variant="ghost" size="sm"
                            className="gap-1 text-xs text-destructive hover:text-destructive"
                            onClick={() => { setCancelModal(r); setCancelTreatment(""); setNoShow(false); setCancellationFee("0"); setOperationError("") }}
                          >
                            <XCircle className="size-3.5" /> Cancelar
                          </Button></PermissionGate>
                        </>
                      )}
                      {isCheckInOverdue(r) && (
                        <PermissionGate permission="reservations.cancel"><Button
                          variant="ghost" size="sm"
                          className="gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleNoShow(r)}
                        >
                          <UserX className="size-3.5" /> No-Show
                        </Button></PermissionGate>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!detailSheet} onOpenChange={v => { if (!v) setDetailSheet(null) }}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {detailSheet && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Eye className="size-5 text-primary" />
                  Reserva {detailSheet.id}
                </SheetTitle>
                <SheetDescription>
                  Detalhes completos da reserva
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-5 py-6">
                <Badge className={`${statusBadgeClass[detailSheet.status]} w-fit text-xs`}>
                  {statusLabels[detailSheet.status]}
                </Badge>

                <div className="flex flex-col gap-3">
                  <DetailRow icon={<User className="size-4" />} label="Hospede" value={detailSheet.guestName} />
                  <DetailRow icon={<Search className="size-4" />} label="CPF" value={detailSheet.cpf} />
                  <DetailRow icon={<BedDouble className="size-4" />} label="Quarto" value={detailSheet.roomNumber} />
                  <Separator />
                  <DetailRow icon={<CalendarDays className="size-4" />} label="Check-in" value={formatDateBR(detailSheet.checkIn)} />
                  <DetailRow icon={<CalendarDays className="size-4" />} label="Check-out" value={formatDateBR(detailSheet.checkOut)} />
                  <Separator />
                  <DetailRow icon={<DollarSign className="size-4" />} label="Valor Total" value={formatCurrency(detailSheet.totalValue)} />
                  <p className="text-sm">Pagador: {customers.find(c => c.id === detailSheet.payerId)?.name ?? 'Titular legado'} · Pessoas: {detailSheet.guestCount ?? 'não informadas no registro antigo'}</p>
                  {detailSheet.nightlyPrices && <LodgingQuotePreview result={{ quote: { nights: detailSheet.nightlyPrices, total: detailSheet.nightlyPrices.reduce((sum, n) => sum + n.total, 0) } }} />}
                  {detailSheet.priceExceptionReason && <p className="text-sm">Preço autorizado: {detailSheet.priceExceptionReason}</p>}
                  {detailSheet.cancelTreatment && (
                    <DetailRow icon={<AlertTriangle className="size-4" />} label="Tratativa" value={detailSheet.cancelTreatment} />
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  {(detailSheet.status === "confirmada" || detailSheet.status === "checkin") && (
                    <>
                      <PermissionGate permission="reservations.edit"><Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => { openEdit(detailSheet); setDetailSheet(null) }}>
                        <Pencil className="size-3.5" /> Editar
                      </Button></PermissionGate>
                      <PermissionGate permission="reservations.cancel"><Button
                        variant="outline" size="sm"
                        className="gap-1.5 flex-1 text-destructive hover:text-destructive"
                        onClick={() => { setCancelModal(detailSheet); setCancelTreatment(""); setNoShow(false); setCancellationFee("0"); setOperationError(""); setDetailSheet(null) }}
                      >
                        <XCircle className="size-3.5" /> Cancelar
                      </Button></PermissionGate>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Modal */}
      <Dialog open={!!editModal} onOpenChange={v => { if (!v) setEditModal(null) }}>
        <DialogContent mobileTask protectDraft className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Reserva {editModal?.id}</DialogTitle>
            <DialogDescription>
              {editModal?.guestName} - Quarto {editModal?.roomNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Check-in</Label>
              <Input type="date" value={editCheckIn} onChange={e => setEditCheckIn(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Check-out</Label>
              <Input type="date" value={editCheckOut} onChange={e => setEditCheckOut(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Valor por quarto (R$)</Label>
              <Input type="number" value={editTotal} onChange={e => setEditTotal(e.target.value)} />
            </div>
          </div>
          {editModal?.guestCount && <div className="space-y-2"><p className="text-sm text-muted-foreground">O preço acordado é mantido. Ao mudar datas, recalcule a tarifa ou autorize uma exceção.</p><LodgingQuotePreview result={previewLodging(rooms.find(r => r.id === editModal.roomId), lodgingTariffs, editModal.guestCount, editCheckIn, editCheckOut)} /><Button variant="outline" onClick={() => { const result = previewLodging(rooms.find(r => r.id === editModal.roomId), lodgingTariffs, editModal.guestCount!, editCheckIn, editCheckOut); if (result.quote) setEditTotal(String(result.quote.total)); else setOperationError(result.error ?? '') }}>Aplicar tarifa atual</Button>{can('lodgingTariffs.override') && <div><Label htmlFor="edit-price-reason">Motivo para preço excepcional</Label><Input id="edit-price-reason" value={editReason} onChange={e => setEditReason(e.target.value)} /></div>}</div>}
          <DialogFooter>
            {operationError && <p role="alert" className="text-destructive">{operationError}</p>}
            <Button variant="outline" onClick={() => setEditModal(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel modal */}
      <Dialog open={!!cancelModal} onOpenChange={v => { if (!v) setCancelModal(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar Reserva {cancelModal?.id}</DialogTitle>
            <DialogDescription>
              Reserva de {cancelModal?.guestName}. Selecione a tratativa do valor.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label>Tratativa do Valor</Label>
            <Select value={cancelTreatment} onValueChange={setCancelTreatment}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a tratativa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="estorno">Estorno Integral</SelectItem>
                <SelectItem disabled={!can("reservations.feeCredit")} value="multa">Retencao (Multa)</SelectItem>
                <SelectItem disabled={!can("reservations.feeCredit")} value="credito">Credito para Proxima Estadia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Label>Multa definida pelo supervisor (R$)<Input aria-label="Multa de cancelamento" type="number" min="0" max={cancelModal?.paidValue ?? 0} step="0.01" value={cancelTreatment === "estorno" ? "0" : cancellationFee} disabled={cancelTreatment === "estorno" || !can("reservations.feeCredit")} onChange={event => setCancellationFee(event.target.value)} /></Label>
          <p className="text-sm text-muted-foreground">Recebido: R$ {(cancelModal?.paidValue ?? 0).toFixed(2)} · Saldo para {cancelTreatment === "credito" ? "crédito" : "reembolso"}: R$ {Math.max(0, (cancelModal?.paidValue ?? 0) - (cancelTreatment === "estorno" ? 0 : Number(cancellationFee) || 0)).toFixed(2)}</p>
          {operationError && <p role="alert" className="text-destructive">{operationError}</p>}
          <DialogFooter>
            <PermissionGate permission="reservations.cancel"><Button variant="outline" disabled={pending} onClick={() => setCancelModal(null)}>Voltar</Button></PermissionGate>
            <Button variant="destructive" disabled={!cancelTreatment || pending} onClick={handleCancel}>Confirmar Cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground">{value}</span>
      </div>
    </div>
  )
}
