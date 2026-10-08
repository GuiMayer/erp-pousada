"use client"
import { PermissionGate } from "@/components/permission-gate"
import { useState } from "react"
import type { Reservation } from "@/lib/store"
import { useApp } from "@/lib/app-context"
import { getDataConfig } from "@/lib/data/config"
import { Button } from "@/components/ui/button"
import { PaymentDialog } from "./payment-fields"

export function ReservationPaymentButton({ reservation }: { reservation: Reservation }) {
  const { runOperation, guests, updateReservation, addTransaction } = useApp()
  const [open, setOpen] = useState(false)
  const balance = Math.max(0, reservation.totalValue - (reservation.paidValue ?? 0))
  if (!['confirmada', 'checkin'].includes(reservation.status) || balance <= 0) return null
  const credit = guests.find(guest => guest.cpf === reservation.cpf)?.creditValue ?? 0
  return <><PermissionGate permission="hospitality.receive"><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Receber hospedagem · R$ {balance.toFixed(2)}</Button></PermissionGate>
    <PaymentDialog open={open} onClose={() => setOpen(false)} title={`Hospedagem — ${reservation.guestName}${credit ? ` · crédito R$ ${credit.toFixed(2)}` : ""}`} maximum={balance} allowCredit={credit > 0 && getDataConfig().adapter === "database"} onConfirm={async (paymentMethod, accountId, value) => {
      if (getDataConfig().adapter === "database") await runOperation("pay-reservation", { reservationId: reservation.id, value, paymentMethod, accountId })
      else { await addTransaction({ id: crypto.randomUUID(), date: new Date().toISOString(), description: `Hospedagem ${reservation.id}`, refId: reservation.id, type: "receita", value, paymentMethod }); await updateReservation(reservation.id, { paidValue: (reservation.paidValue ?? 0) + value }) }
    }} />
  </>
}
