"use client"
import { useState } from "react"
import type { Reservation } from "@/lib/store"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { reservationPerson, whatsappContact } from "@/lib/reservation-contact"
import { Button } from "./ui/button"

export function ReservationContact({ reservation }: { reservation: Reservation }) {
  const { customers, guests } = useApp()
  const { can } = useAuth()
  const [status, setStatus] = useState("")
  if (!can("customers.read")) return null
  const person = reservationPerson(reservation, customers, guests)
  const phones = [person?.phone?.trim(), person?.phone2?.trim()].filter((value): value is string => !!value)
  const raw = phones.find(value => whatsappContact(value)) ?? phones[0]
  if (!raw) return <p className="text-xs text-muted-foreground">Telefone não informado.</p>
  const contact = whatsappContact(raw)
  async function copy() {
    try { await navigator.clipboard.writeText(raw!); setStatus("Telefone copiado.") }
    catch { setStatus("Não foi possível copiar automaticamente. Selecione o telefone exibido para copiar.") }
  }
  return <div className="space-y-1 text-sm" onClick={event => event.stopPropagation()}>
    <p className="select-text break-words">{contact?.display ?? raw}</p>
    {contact ? <p className="text-xs text-muted-foreground">DDI {contact.ddi} · {person?.name}. Confira o destinatário antes de conversar.</p> : <p className="text-xs text-muted-foreground">Para WhatsApp, revise o telefone no cadastro: DDD brasileiro ou número internacional com +DDI.</p>}
    <div className="flex flex-wrap items-center gap-2">{contact && <Button asChild variant="link" size="sm" className="min-h-11 px-0"><a href={contact.href} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp de ${person?.name}, ${contact.display}`}>WhatsApp</a></Button>}<Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => void copy()}>Copiar telefone</Button></div>
    {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
  </div>
}
