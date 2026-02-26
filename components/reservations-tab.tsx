"use client"

import { useState, useMemo } from "react"
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

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
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
    reservations, rooms, addReservation, updateReservation,
    updateRoom, findGuest, addAuditEntry,
  } = useApp()
  const { username } = useAuth()

  const [showNewForm, setShowNewForm] = useState(false)
  const [cancelModal, setCancelModal] = useState<Reservation | null>(null)
  const [cancelTreatment, setCancelTreatment] = useState<string>("")
  const [detailSheet, setDetailSheet] = useState<Reservation | null>(null)
  const [editModal, setEditModal] = useState<Reservation | null>(null)

  // New reservation form state
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

  const availableRooms = rooms.filter(r => r.status === "disponivel")

  function handleCpfSearch(cpf: string) {
    setNewCpf(cpf)
    if (cpf.length >= 11) {
      const guest = findGuest(cpf)
      setFoundGuest(guest)
      if (guest) setNewGuestName(guest.name)
    } else {
      setFoundGuest(undefined)
    }
  }

  function handleCreateReservation() {
    if (!newCpf || !newGuestName || !newCheckIn || !newCheckOut) return
    const validRoomIds = selectedRooms.filter(Boolean)
    if (validRoomIds.length === 0) return

    validRoomIds.forEach((roomIdStr, idx) => {
      const room = rooms.find(r => r.id === Number(roomIdStr))
      if (!room) return

      const reservation: Reservation = {
        id: `R${String(reservations.length + 1 + idx).padStart(3, "0")}`,
        roomId: room.id,
        roomNumber: room.number,
        guestName: newGuestName,
        cpf: newCpf,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        status: "confirmada",
        totalValue: Number(newTotal) || 0,
      }
      addReservation(reservation)
    })

    addAuditEntry({
      user: username || "sistema",
      action: `Reserva criada (${validRoomIds.length} quarto${validRoomIds.length > 1 ? "s" : ""})`,
      reference: `${newGuestName}`,
    })

    // Reset
    setNewCpf(""); setFoundGuest(undefined); setNewGuestName("")
    setSelectedRooms([""]); setNewCheckIn(""); setNewCheckOut(""); setNewTotal("")
    setShowNewForm(false)
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

  function handleCancel() {
    if (!cancelModal || !cancelTreatment) return
    updateReservation(cancelModal.id, {
      status: "cancelada",
      cancelTreatment: cancelTreatment as "estorno" | "multa" | "credito",
    })
    updateRoom(cancelModal.roomId, {
      status: "disponivel", guest: undefined, guestCpf: undefined,
      checkIn: undefined, checkOut: undefined,
    })
    addAuditEntry({
      user: username || "sistema",
      action: `Cancelamento de reserva (${cancelTreatment})`,
      reference: `${cancelModal.id} - ${cancelModal.guestName}`,
    })
    setCancelModal(null)
    setCancelTreatment("")
  }

  function handleNoShow(r: Reservation) {
    updateReservation(r.id, { status: "noshow" })
    updateRoom(r.roomId, {
      status: "disponivel", guest: undefined, guestCpf: undefined,
      checkIn: undefined, checkOut: undefined,
    })
    addAuditEntry({
      user: username || "sistema",
      action: "No-show registrado",
      reference: `${r.id} - ${r.guestName}`,
    })
  }

  function openEdit(r: Reservation) {
    setEditModal(r)
    setEditCheckIn(r.checkIn)
    setEditCheckOut(r.checkOut)
    setEditTotal(String(r.totalValue))
  }

  function handleSaveEdit() {
    if (!editModal) return
    updateReservation(editModal.id, {
      checkIn: editCheckIn,
      checkOut: editCheckOut,
      totalValue: Number(editTotal) || 0,
    })
    addAuditEntry({
      user: username || "sistema",
      action: "Reserva editada",
      reference: `${editModal.id} - ${editModal.guestName}`,
    })
    setEditModal(null)
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-foreground">Reservas</h2>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNewForm(!showNewForm)}>
          <Plus className="size-4" />
          Nova Reserva
        </Button>
      </div>

      {/* New reservation form */}
      {showNewForm && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold text-foreground">Nova Reserva</h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>CPF / CNPJ</Label>
                <div className="flex gap-2">
                  <Input placeholder="000.000.000-00" value={newCpf} onChange={e => handleCpfSearch(e.target.value)} />
                  <Button variant="outline" size="icon" className="shrink-0">
                    <Search className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Nome do Hospede</Label>
                <Input value={newGuestName} onChange={e => setNewGuestName(e.target.value)} placeholder="Nome completo" />
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

            {/* Room selection with group support */}
            <div className="flex flex-col gap-3">
              <Label>Quartos</Label>
              {selectedRooms.map((roomId, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1">
                    <RoomCombobox
                      rooms={availableRooms.filter(r => !usedRoomIds.has(String(r.id)) || String(r.id) === roomId)}
                      value={roomId}
                      onChange={(v) => handleRoomChange(index, v)}
                    />
                  </div>
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
                <Label>Check-in</Label>
                <Input type="date" value={newCheckIn} onChange={e => setNewCheckIn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Check-out</Label>
                <Input type="date" value={newCheckOut} onChange={e => setNewCheckOut(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Valor Total (R$)</Label>
                <Input type="number" value={newTotal} onChange={e => setNewTotal(e.target.value)} placeholder="0,00" />
              </div>
            </div>

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
          <Table>
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
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      {(r.status === "confirmada" || r.status === "checkin") && (
                        <>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => openEdit(r)}>
                            <Pencil className="size-3.5" /> Editar
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="gap-1 text-xs text-destructive hover:text-destructive"
                            onClick={() => { setCancelModal(r); setCancelTreatment("") }}
                          >
                            <XCircle className="size-3.5" /> Cancelar
                          </Button>
                        </>
                      )}
                      {isCheckInOverdue(r) && (
                        <Button
                          variant="ghost" size="sm"
                          className="gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleNoShow(r)}
                        >
                          <UserX className="size-3.5" /> No-Show
                        </Button>
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
                  {detailSheet.cancelTreatment && (
                    <DetailRow icon={<AlertTriangle className="size-4" />} label="Tratativa" value={detailSheet.cancelTreatment} />
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  {(detailSheet.status === "confirmada" || detailSheet.status === "checkin") && (
                    <>
                      <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => { openEdit(detailSheet); setDetailSheet(null) }}>
                        <Pencil className="size-3.5" /> Editar
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="gap-1.5 flex-1 text-destructive hover:text-destructive"
                        onClick={() => { setCancelModal(detailSheet); setCancelTreatment(""); setDetailSheet(null) }}
                      >
                        <XCircle className="size-3.5" /> Cancelar
                      </Button>
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
        <DialogContent className="sm:max-w-md">
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
              <Label>Valor Total (R$)</Label>
              <Input type="number" value={editTotal} onChange={e => setEditTotal(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
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
                <SelectItem value="multa">Retencao (Multa)</SelectItem>
                <SelectItem value="credito">Credito para Proxima Estadia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModal(null)}>Voltar</Button>
            <Button variant="destructive" disabled={!cancelTreatment} onClick={handleCancel}>Confirmar Cancelamento</Button>
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
