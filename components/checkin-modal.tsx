"use client"
import { getDataConfig } from "@/lib/data/config"
import { useToast } from "@/hooks/use-toast"

import { businessDay } from "@/lib/utils/business-values"
import { useState, useEffect, useRef } from "react"
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
import { useNotifications } from "@/lib/notification-context"
import { useGuestSearch } from "@/lib/hooks/useGuestSearch"
import { Search, User, BarChart3, AlertTriangle, LogIn } from "lucide-react"
import type { Room } from "@/lib/store"

type Props = {
  room: Room
  open: boolean
  onClose: () => void
}

export function CheckinModal({ room, open, onClose }: Props) {
  const { runOperation, updateRoom, addReservation, addAuditEntry, findGuest, addGuest, reservations } = useApp()
  const { username } = useAuth()
  const { sendNotification } = useNotifications()

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

  const initialized = useRef(false)
  useEffect(() => {
    if (!open) { initialized.current = false; return }
    if (initialized.current) return
    initialized.current = true
    const expected = reservations.find(reservation => reservation.roomId === room.id && reservation.status === "confirmada" && reservation.checkIn === businessDay())
    if (expected) { setCpf(expected.cpf); setGuestName(expected.guestName); setCheckOut(expected.checkOut); setTotalValue(String(expected.totalValue)) }
  }, [open, reservations, room.id, setCpf, setGuestName])
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  async function handleConfirm() {
    if (pending) return
    if (!cpf || !guestName || !checkOut) return

    const todayISO = businessDay()

    setPending(true)
    try {
    if (getDataConfig().adapter === "database") {
      await runOperation("check-in", { roomId: room.id, cpf, guestName, checkIn: todayISO, checkOut, totalValue: Number(totalValue) || 0 })
    } else {
    await updateRoom(room.id, {
      status: "ocupado",
      guest: guestName,
      guestCpf: cpf,
      checkIn: todayISO,
      checkOut: checkOut,
      checkOutTime: "12:00",
    })

    if (isNewGuest) {
      await addGuest({ cpf, name: guestName, totalStays: 1, avgTicket: Number(totalValue) || 0, noShows: 0 })
    }

    const resId = `R${String(reservations.length + 1).padStart(3, "0")}`
    await addReservation({
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

    await addAuditEntry({
      user: username || "sistema",
      action: "Check-in realizado",
      reference: `Quarto ${room.number} - ${guestName}`,
    })

    }
    sendNotification(
      'check-in',
      'Check-in Realizado',
      `Quarto ${room.number} - ${guestName} realizou check-in`,
      'high',
      String(room.id)
    )

    // Reset and close
    resetGuest()
    setCheckOut("")
    setTotalValue("")
    onClose()
    } catch (error) { toast({ title: "Check-in não concluído", description: error instanceof Error ? error.message : "Tente novamente", variant: "destructive" }) }
    finally { setPending(false) }
  }

  function handleClose() {
    resetGuest()
    setCheckOut("")
    setTotalValue("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent mobileTask protectDraft className="sm:max-w-lg">
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
              <Label htmlFor="checkin-cpf">CPF</Label>
              <div className="flex gap-2">
                <Input
                  id="checkin-cpf" inputMode="numeric"
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
              <Label htmlFor="checkin-name">Nome do Hospede</Label>
              <Input
                id="checkin-name" autoComplete="name"
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
              <Label htmlFor="checkin-out">Data de Saida</Label>
              <Input id="checkin-out" type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="checkin-total">Valor Total (R$)</Label>
              <Input id="checkin-total" inputMode="decimal" type="number" value={totalValue} onChange={e => setTotalValue(e.target.value)} placeholder="0,00" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button disabled={pending || !cpf || !guestName || !checkOut} onClick={handleConfirm}>
            Confirmar Check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
