"use client"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { getDataConfig } from "@/lib/data/config"
import { validateSupervisorPasswordAsync } from "@/lib/utils/validators"
import { formatCurrency } from "@/lib/utils/formatters"
import type { Reservation } from "@/lib/store"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog"

export function ReservationDiscountDialog({ reservation, onClose, onApplied }: { reservation: Reservation; onClose: () => void; onApplied?: () => void }) {
  const { can } = useAuth()
  const { runOperation, updateReservation, discountCeiling } = useApp()
  const [type, setType] = useState("percent"), [value, setValue] = useState("")
  const [password, setPassword] = useState(""), [unlocked, setUnlocked] = useState(false)
  const [pending, setPending] = useState(false), [error, setError] = useState("")
  const total = Math.round(reservation.totalValue * 100)
  const amount = Math.round(type === "percent" ? total * Number(value) / 100 : Number(value) * 100)
  const remaining = (total - amount) / 100
  const original = reservation.originalValue ?? reservation.totalValue
  const cumulative = original > 0 ? (1 - remaining / original) * 100 : 0
  const requiresSupervisor = getDataConfig().adapter === "demo-localStorage" && !can("discount.override") && cumulative > discountCeiling
  const allowed = can("reservations.discount") && ["confirmada", "checkin"].includes(reservation.status)
  async function apply() {
    if (pending || !allowed || requiresSupervisor && !unlocked) return
    setError("")
    if (!Number.isFinite(amount) || amount <= 0 || amount > total || type === "percent" && Number(value) > 100) { setError("Informe um desconto positivo até o valor contratado."); return }
    if (Math.round(remaining * 100) < Math.round((reservation.paidValue ?? 0) * 100)) { setError("O desconto não pode deixar o valor contratado abaixo do recebido."); return }
    setPending(true)
    try {
      if (getDataConfig().adapter === "database") await runOperation("reservation-discount", { reservationId: reservation.id, type, value: Number(value) })
      else await updateReservation(reservation.id, { totalValue: remaining })
      onClose(); onApplied?.()
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Desconto não aplicado") } finally { setPending(false) }
  }
  return <Dialog open={allowed} onOpenChange={open => { if (!open && !pending) onClose() }}><DialogContent mobileTask protectDraft busy={pending} className="sm:max-w-md">
    <DialogHeader><DialogTitle>Aplicar desconto</DialogTitle><DialogDescription>{reservation.guestName} · Quarto {reservation.roomNumber} · Reserva {reservation.id}</DialogDescription></DialogHeader>
    <p className="text-sm">Contratado: {formatCurrency(reservation.totalValue)} · Recebido: {formatCurrency(reservation.paidValue ?? 0)}. Teto do operador: {discountCeiling}% sobre o desconto acumulado.</p>
    <Label className="flex-col items-stretch">Tipo de desconto<select className="min-h-11 rounded border bg-background px-3" disabled={pending} value={type} onChange={event => { setType(event.target.value); setUnlocked(false) }}><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select></Label>
    <Label className="flex-col items-stretch">Valor do desconto<Input type="number" min="0" step="0.01" disabled={pending} value={value} onChange={event => { setValue(event.target.value); setUnlocked(false) }} /></Label>
    {!!value && Number.isFinite(remaining) && <p className="text-sm">Valor após desconto: {formatCurrency(remaining)}</p>}
    {requiresSupervisor && !unlocked && <div className="space-y-2 rounded border p-3"><p className="text-sm">O desconto acumulado ultrapassa o teto. Solicite a liberação do supervisor.</p><Label className="flex-col items-stretch">Senha do supervisor<Input type="password" value={password} onChange={event => setPassword(event.target.value)} /></Label><Button variant="outline" onClick={async () => { if (await validateSupervisorPasswordAsync(password)) setUnlocked(true); else setError("Senha do supervisor incorreta") }}>Liberar desconto</Button></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <DialogFooter><Button variant="outline" disabled={pending} onClick={onClose}>Voltar</Button><Button disabled={pending || !value || requiresSupervisor && !unlocked} onClick={apply}>{pending ? "Aplicando…" : "Aplicar desconto"}</Button></DialogFooter>
  </DialogContent></Dialog>
}

export function ReservationDiscountButton({ reservation, disabled, onApplied }: { reservation: Reservation; disabled?: boolean; onApplied?: () => void }) {
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  if (!can("reservations.discount") || !["confirmada", "checkin"].includes(reservation.status)) return null
  return <><Button size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>Aplicar desconto</Button>{open && <ReservationDiscountDialog reservation={reservation} onClose={() => setOpen(false)} onApplied={onApplied} />}</>
}
