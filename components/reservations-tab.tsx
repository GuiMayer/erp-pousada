"use client"

import { useState } from "react"
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Plus, XCircle, UserX, Search, User, BarChart3, AlertTriangle,
} from "lucide-react"
import type { Reservation, GuestProfile } from "@/lib/store"

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

export function ReservationsTab() {
  const {
    reservations, rooms, addReservation, updateReservation,
    updateRoom, findGuest, addAuditEntry,
  } = useApp()
  const { username } = useAuth()

  const [showNewForm, setShowNewForm] = useState(false)
  const [cancelModal, setCancelModal] = useState<Reservation | null>(null)
  const [cancelTreatment, setCancelTreatment] = useState<string>("")

  // New reservation form state
  const [newCpf, setNewCpf] = useState("")
  const [foundGuest, setFoundGuest] = useState<GuestProfile | undefined>()
  const [newGuestName, setNewGuestName] = useState("")
  const [newRoomId, setNewRoomId] = useState("")
  const [newCheckIn, setNewCheckIn] = useState("")
  const [newCheckOut, setNewCheckOut] = useState("")
  const [newTotal, setNewTotal] = useState("")

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
    if (!newCpf || !newGuestName || !newRoomId || !newCheckIn || !newCheckOut) return
    const room = rooms.find(r => r.id === Number(newRoomId))
    if (!room) return

    const reservation: Reservation = {
      id: `R${String(reservations.length + 1).padStart(3, "0")}`,
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
    addAuditEntry({ user: username || "sistema", action: "Nova reserva criada", reference: `${reservation.id} - ${newGuestName}` })

    // Reset form
    setNewCpf(""); setFoundGuest(undefined); setNewGuestName("")
    setNewRoomId(""); setNewCheckIn(""); setNewCheckOut(""); setNewTotal("")
    setShowNewForm(false)
  }

  function handleCancel() {
    if (!cancelModal || !cancelTreatment) return
    updateReservation(cancelModal.id, {
      status: "cancelada",
      cancelTreatment: cancelTreatment as "estorno" | "multa" | "credito",
    })
    // Free the room
    updateRoom(cancelModal.roomId, { status: "disponivel", guest: undefined, guestCpf: undefined, checkIn: undefined, checkOut: undefined })
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
    updateRoom(r.roomId, { status: "disponivel", guest: undefined, guestCpf: undefined, checkIn: undefined, checkOut: undefined })
    addAuditEntry({ user: username || "sistema", action: "No-show registrado", reference: `${r.id} - ${r.guestName}` })
  }

  const isCheckInOverdue = (r: Reservation) => {
    if (r.status !== "confirmada") return false
    const now = new Date()
    const checkin = new Date(r.checkIn + "T14:00:00")
    return now > checkin
  }

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
                  <Input
                    placeholder="000.000.000-00"
                    value={newCpf}
                    onChange={e => handleCpfSearch(e.target.value)}
                  />
                  <Button variant="outline" size="icon" className="shrink-0">
                    <Search className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Nome do Hospede</Label>
                <Input
                  value={newGuestName}
                  onChange={e => setNewGuestName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
            </div>

            {/* Guest profile card */}
            {foundGuest && (
              <div className="rounded-lg bg-secondary/60 px-4 py-3 flex flex-wrap gap-6 items-center">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{foundGuest.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BarChart3 className="size-3" />
                    {foundGuest.totalStays} estadias
                  </span>
                  <span>Ticket medio: {formatCurrency(foundGuest.avgTicket)}</span>
                  {foundGuest.noShows > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="size-3" />
                      {foundGuest.noShows} no-show(s)
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label>Quarto</Label>
                <Select value={newRoomId} onValueChange={setNewRoomId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.number} - {r.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowNewForm(false)}>Cancelar</Button>
              <Button
                size="sm"
                disabled={!newCpf || !newGuestName || !newRoomId || !newCheckIn || !newCheckOut}
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
                <TableRow key={r.id}>
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
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {(r.status === "confirmada" || r.status === "checkin") && (
                        <Button
                          variant="ghost" size="sm"
                          className="gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => { setCancelModal(r); setCancelTreatment("") }}
                        >
                          <XCircle className="size-3.5" /> Cancelar
                        </Button>
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
