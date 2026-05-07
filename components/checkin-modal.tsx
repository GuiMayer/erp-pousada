"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useGuestSearch } from "@/lib/hooks/useGuestSearch"
import { Search, User, BarChart3, AlertTriangle, LogIn } from "lucide-react"
import type { Room } from "@/lib/store"

type Props = {
  room: Room
  open: boolean
  onClose: () => void
}

export function CheckinModal({ room, open, onClose }: Props) {
  const { updateRoom, addReservation, addAuditEntry, findGuest, addGuest, reservations } = useApp()
  const { username } = useAuth()

  const [checkOut, setCheckOut] = useState("")
  const [totalValue, setTotalValue] = useState("")

  // Use custom hook for guest search
  const {
    cpf,
    setCpf,
    guestName,
    setGuestName,
    foundGuest,
    isValidCPF,
    isNewGuest,
    reset: resetGuest,
  } = useGuestSearch(findGuest)

  function handleConfirm() {
    if (!cpf || !guestName || !checkOut) return

    const todayISO = new Date().toISOString().split("T")[0]

    updateRoom(room.id, {
      status: "ocupado",
      guest: guestName,
      guestCpf: cpf,
      checkIn: todayISO,
      checkOut: checkOut,
      checkOutTime: "12:00",
    })

    if (isNewGuest) {
      addGuest({ cpf, name: guestName, totalStays: 1, avgTicket: Number(totalValue) || 0, noShows: 0 })
    }

    const resId = `R${String(reservations.length + 1).padStart(3, "0")}`
    addReservation({
      id: resId,
      roomId: room.id,
      roomNumber: room.number,
      guestName,
      cpf,
      checkIn: todayISO,
      checkOut,
      status: "checkin",
      totalValue: Number(totalValue) || 0,
    })

    addAuditEntry({
      user: username || "sistema",
      action: "Check-in realizado",
      reference: `Quarto ${room.number} - ${guestName}`,
    })

    // Reset and close
    resetGuest()
    setCheckOut("")
    setTotalValue("")
    onClose()
  }

  function handleClose() {
    resetGuest()
    setCheckOut("")
    setTotalValue("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="size-5 text-primary" />
            Check-in - Quarto {room.number}
          </DialogTitle>
          <DialogDescription>
            {room.type} - Preencha os dados do hospede para realizar o check-in.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>CPF</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={e => setCpf(e.target.value)}
                />
                <Button variant="outline" size="icon" className="shrink-0" disabled>
                  <Search className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Nome do Hospede</Label>
              <Input
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
          </div>

          {foundGuest && (
            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-secondary/60 px-4 py-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{foundGuest.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BarChart3 className="size-3" />
                  {foundGuest.totalStays} estadias
                </span>
                <span className="flex items-center gap-1">
                  Ticket: <CurrencyDisplay value={foundGuest.avgTicket} size="sm" className="inline" />
                </span>
                {foundGuest.noShows > 0 && (
                  <Badge className="gap-1 bg-destructive/15 text-destructive border-transparent text-[10px]">
                    <AlertTriangle className="size-3" />
                    {foundGuest.noShows} no-show(s)
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Data de Saida</Label>
              <Input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Valor Total (R$)</Label>
              <Input type="number" value={totalValue} onChange={e => setTotalValue(e.target.value)} placeholder="0,00" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button disabled={!cpf || !guestName || !checkOut} onClick={handleConfirm}>
            Confirmar Check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
