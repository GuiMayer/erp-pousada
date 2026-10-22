"use client"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { getDataConfig } from "@/lib/data/config"
import { validateSupervisorPasswordAsync } from "@/lib/utils/validators"
import { formatCurrency } from "@/lib/utils/formatters"
import { lodgingDiscount, type DiscountScope, type DiscountType } from "@/lib/lodging-summary"
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group"
import type { Reservation } from "@/lib/store"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog"

export function ReservationDiscountDialog({ reservation, onClose, onApplied }: { reservation: Reservation; onClose: () => void; onApplied?: () => void }) {
  const { can } = useAuth()
  const { runOperation, updateReservation, discountCeiling } = useApp()
  const [type, setType] = useState<DiscountType>("percent"), [value, setValue] = useState("")
  const [scope, setScope] = useState<DiscountScope>("total")
  const [password, setPassword] = useState(""), [unlocked, setUnlocked] = useState(false)
  const [pending, setPending] = useState(false), [error, setError] = useState("")
  const total = Math.round(reservation.totalValue * 100)
  const calculation = (() => { try { return lodgingDiscount(reservation.totalValue, reservation.checkIn, reservation.checkOut, type, Number(value), scope) } catch { return undefined } })()
  const amount = calculation ? Math.round(calculation.amount * 100) : NaN
  const remaining = calculation?.remaining ?? NaN
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
      if (getDataConfig().adapter === "database") await runOperation("reservation-discount", { reservationId: reservation.id, type, value: Number(value), scope })
      else await updateReservation(reservation.id, { totalValue: remaining })
      onClose(); onApplied?.()
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Desconto não aplicado") } finally { setPending(false) }
  }
  return <Dialog open={allowed} onOpenChange={open => { if (!open && !pending) onClose() }}><DialogContent mobileTask protectDraft busy={pending} className="sm:max-w-md">
    <DialogHeader><DialogTitle>Aplicar desconto</DialogTitle><DialogDescription>{reservation.guestName} · Quarto {reservation.roomNumber} · Reserva {reservation.id}</DialogDescription></DialogHeader>
    <div className="min-w-0 space-y-4">
    <p className="text-sm">Contratado: {formatCurrency(reservation.totalValue)} · Recebido: {formatCurrency(reservation.paidValue ?? 0)}. Teto do operador: {discountCeiling}% sobre o desconto acumulado.</p>
    <div className="space-y-2"><Label htmlFor="reservation-discount-scope">Aplicar em</Label><select id="reservation-discount-scope" className="min-h-11 w-full rounded border bg-background px-3" disabled={pending} value={scope} onChange={event => { setScope(event.target.value as DiscountScope); setUnlocked(false) }}><option value="total">Total da hospedagem</option><option value="night">Por diária (todas as diárias)</option></select></div>
    <div className="space-y-2"><Label htmlFor="reservation-discount-value">Valor do desconto</Label>
      <div className="flex items-stretch rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
        <ToggleGroup type="single" style={{ width: "auto" }} aria-label="Tipo de desconto" value={type} disabled={pending} onValueChange={next => { if (next) { setType(next as DiscountType); setUnlocked(false) } }} className="shrink-0 rounded-r-none border-r">
          <ToggleGroupItem value="percent" aria-label="Percentual (%)" className="min-h-11 min-w-11">%</ToggleGroupItem><ToggleGroupItem value="fixed" aria-label="Valor fixo (R$)" className="min-h-11 min-w-11">R$</ToggleGroupItem>
        </ToggleGroup>
        <Input id="reservation-discount-value" type="number" min="0" max={type === "percent" ? 100 : undefined} step="0.01" inputMode="decimal" aria-describedby="reservation-discount-preview" className="min-h-11 w-0 min-w-0 flex-1 rounded-l-none border-0 shadow-none focus-visible:ring-0" disabled={pending} value={value} onChange={event => { setValue(event.target.value); setUnlocked(false) }} />
      </div>
    </div>
    <div id="reservation-discount-preview" role="status" className="text-sm" aria-live="polite">{calculation ? <><p>Desconto total: {formatCurrency(calculation.amount)}{scope === "night" && ` · ${calculation.nights} diária(s)`}</p><p className="font-medium">Valor após desconto: {formatCurrency(remaining)}</p></> : <p className="text-muted-foreground">{scope === "night" ? "O desconto será aplicado a todas as diárias contratadas." : "O desconto será aplicado uma vez ao total contratado."}</p>}</div>
    {requiresSupervisor && !unlocked && <div className="space-y-2 rounded border p-3"><p className="text-sm">O desconto acumulado ultrapassa o teto. Solicite a liberação do supervisor.</p><Label className="flex-col items-stretch">Senha do supervisor<Input type="password" value={password} onChange={event => setPassword(event.target.value)} /></Label><Button variant="outline" onClick={async () => { if (await validateSupervisorPasswordAsync(password)) setUnlocked(true); else setError("Senha do supervisor incorreta") }}>Liberar desconto</Button></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
    <DialogFooter><Button variant="outline" disabled={pending} onClick={onClose}>Voltar</Button><Button disabled={pending || !value || requiresSupervisor && !unlocked} onClick={apply}>{pending ? "Aplicando…" : "Aplicar desconto"}</Button></DialogFooter>
  </DialogContent></Dialog>
}

export function ReservationDiscountButton({ reservation, disabled, onApplied }: { reservation: Reservation; disabled?: boolean; onApplied?: () => void }) {
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  if (!can("reservations.discount") || !["confirmada", "checkin"].includes(reservation.status)) return null
  return <><Button size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>Aplicar desconto</Button>{open && <ReservationDiscountDialog reservation={reservation} onClose={() => setOpen(false)} onApplied={onApplied} />}</>
}
