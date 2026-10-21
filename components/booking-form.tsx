"use client"

import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { businessDay } from "@/lib/utils/business-values"
import { formatCurrency } from "@/lib/utils/formatters"
import { suggestPayerId } from "@/lib/customer-company"
import { normalizeDocument } from "@/lib/utils/cpf-cnpj-validator"
import { checkinDateError } from "@/lib/booking-flow"
import { distributePayment, type PaymentLine } from "@/lib/payments"
import type { Reservation, Room } from "@/lib/store"
import { CustomerCombobox } from "./customer-combobox"
import { LodgingPayerChoice } from "./lodging-payer-choice"
import { LodgingQuotePreview, previewLodging } from "./lodging-quote-preview"
import { PaymentFields } from "./payment-fields"
import { PaymentEditor } from "./payment-editor"
import { CashTurnShortcut } from "./cash-turn-shortcut"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type Props = { intent: "reservation" | "edit" | "checkin"; room?: Room; reservation?: Reservation; onDone: () => void; onBusy?: (value: boolean) => void }
const tomorrow = () => new Date(Date.parse(businessDay()) + 86400000).toISOString().slice(0, 10)

/** One form owns identity, payer, occupancy, quote and optional receipt in every entry point. */
export function BookingForm({ intent, room, reservation: initialReservation, onDone, onBusy }: Props) {
  const { customers, guests, rooms, stays = [], reservations, lodgingTariffs, bankAccounts = [], cashCloses = [], runOperation } = useApp()
  const { can } = useAuth()
  const [reservation, setReservation] = useState(initialReservation)
  const originalPerson = customers.find(c => c.id === guests.find(g => g.cpf === reservation?.cpf)?.customerId || normalizeDocument(c.cpfCnpj) === normalizeDocument(reservation?.cpf ?? ""))
  const [mode, setMode] = useState(intent)
  const [personId, setPersonId] = useState(originalPerson?.id ?? "")
  const [payerId, setPayerId] = useState(reservation?.payerId ?? suggestPayerId(originalPerson, customers))
  const [slots, setSlots] = useState([{ roomId: reservation?.roomId ?? room?.id ?? 0, guestCount: reservation?.guestCount ?? 1 }])
  const [arrival, setArrival] = useState(intent === "checkin" ? businessDay() : reservation?.checkIn ?? businessDay())
  const [departure, setDeparture] = useState(reservation?.checkOut ?? tomorrow())
  const [actualDeparture, setActualDeparture] = useState(businessDay())
  const [exception, setException] = useState(false), [exceptionValue, setExceptionValue] = useState(String(reservation?.totalValue ?? ""))
  const [priceReason, setPriceReason] = useState("")
  const [keepAgreement, setKeepAgreement] = useState(false), [completed, setCompleted] = useState(false), [dateReason, setDateReason] = useState("")
  const [receive, setReceive] = useState(false), [amount, setAmount] = useState("")
  const [method, setMethod] = useState("pix"), [accountId, setAccountId] = useState("")
  const [mixed, setMixed] = useState(false), [lines, setLines] = useState<PaymentLine[]>([])
  const [dueDate, setDueDate] = useState(businessDay()), [creditConfirmed, setCreditConfirmed] = useState(false)
  const [pending, setPending] = useState(false), [error, setError] = useState("")
  const person = customers.find(c => c.id === personId)
  const paid = reservation?.paidValue ?? 0, locked = !!reservation && mode === "checkin"
  const identityLocked = locked || paid > 0
  const unchanged = mode === "edit" && reservation && slots[0].roomId === reservation.roomId && slots[0].guestCount === reservation.guestCount && arrival === reservation.checkIn && departure === reservation.checkOut
  const effectiveDeparture = mode === "checkin" && completed ? actualDeparture : departure
  const quotes = slots.map(s => previewLodging(rooms.find(r => r.id === s.roomId), lodgingTariffs, s.guestCount, arrival, effectiveDeparture))
  const total = locked || (unchanged && !exception) ? reservation!.totalValue : exception ? Number(exceptionValue) * slots.length : quotes.reduce((v, q) => v + (q.quote?.total ?? 0), 0)
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100)
  const receiving = receive ? Number(amount || balance) : 0
  const needsCash = receive && !cashCloses.some(c => c.status === "aberto") && (mixed ? lines.some(p => p.value > 0 && p.method === "dinheiro") : method === "dinheiro")
  const selectedRoom = rooms.find(r => r.id === slots[0]?.roomId)
  const roomUnavailable = mode === "checkin" && !completed && selectedRoom?.status !== "disponivel"
  const retroactive = mode === "checkin" && arrival < businessDay()
  const lateArrival = locked && (reservation.checkIn !== arrival || completed && reservation.checkOut !== effectiveDeparture)
  const profile = guests.find(g => g.customerId === personId)
  const selectClass = "mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm"

  function available(candidate: Room) {
    if (locked && candidate.id === reservation.roomId) return true
    if (mode === "checkin" && !completed && candidate.status !== "disponivel") return false
    if (candidate.status === "bloqueado" && (!candidate.blockEndDate || arrival <= candidate.blockEndDate)) return false
    return !reservations.some(r => r.id !== reservation?.id && r.roomId === candidate.id && r.status === "confirmada" && r.checkIn < effectiveDeparture && r.checkOut > arrival) &&
      !stays.some(s => s.reservationId !== reservation?.id && s.allocations.some(a => a.roomId === candidate.id && a.start < effectiveDeparture && a.end > arrival))
  }

  async function confirm() {
    if (pending) return
    setError("")
    try {
      if (!person?.active || !person.cpfCnpj || !slots.length || slots.some(s => !s.roomId)) throw Error("Selecione o hóspede e o quarto")
      if (mode === "checkin") { const invalid = checkinDateError(arrival, effectiveDeparture, completed); if (invalid) throw Error(invalid) }
      if (arrival >= effectiveDeparture) throw Error("A saída precisa ser posterior à entrada")
      if (retroactive && (!can("hospitality.checkin.backdate") || dateReason.trim().length < 5)) throw Error("Informe o motivo e solicite autorização para o lançamento retroativo")
      if (lateArrival && !keepAgreement) throw Error("Confirme o valor acordado ou edite a reserva antes da entrada")
      if (!locked && !unchanged && !exception && quotes.some(q => !q.quote)) throw Error(quotes.find(q => q.error)?.error ?? "Revise a tarifa")
      if (exception && (!can("lodgingTariffs.override") || priceReason.trim().length < 5)) throw Error("Preço excepcional exige autorização e motivo de pelo menos 5 caracteres")
      if (receive && (!can("hospitality.receive") || receiving <= 0 || receiving > balance)) throw Error("Informe um recebimento positivo até o saldo")
      if (needsCash) throw Error("Abra o caixa antes de receber em dinheiro")
      const payments = mixed ? lines : [{ method, accountId: method === "dinheiro" ? undefined : accountId || undefined, value: receiving }]
      if (receive) distributePayment(receiving, payments)
      const initialPayment = receive ? { value: receiving, payments } : undefined
      const prices = slots.map((s, index) => ({ ...s, totalValue: locked || unchanged && !exception ? reservation!.totalValue : exception ? Number(exceptionValue) : quotes[index].quote!.total, ...(exception ? { priceExceptionReason: priceReason.trim() } : {}) }))
      const base = { cpf: person.cpfCnpj, guestName: person.name, payerId: payerId || person.id, checkIn: arrival, checkOut: reservation ? departure : effectiveDeparture }
      setPending(true); onBusy?.(true)
      if (mode === "edit") {
        const saved = await runOperation<Reservation>("edit-reservation", { ...base, ...prices[0], id: reservation!.id, recordVersion: reservation!.recordVersion })
        if (intent === "checkin" && saved.checkIn <= businessDay()) {
          setReservation(saved); setMode("checkin"); setArrival(saved.checkIn > businessDay() ? saved.checkIn : businessDay()); setDeparture(saved.checkOut); setKeepAgreement(false); setException(false); setPriceReason("")
          return
        }
      }
      else if (mode === "reservation") await runOperation("reserve-group", { ...base, rooms: prices, initialPayment })
      else await runOperation(completed ? "record-completed-stay" : "check-in", { ...base, ...prices[0], ...(reservation ? { reservationId: reservation.id, recordVersion: reservation.recordVersion } : {}), initialPayment, ...(retroactive ? { reason: dateReason.trim() } : {}), keepAgreedPrice: keepAgreement, ...(completed ? { actualCheckOut: effectiveDeparture, dueDate, companyCreditConfirmed: creditConfirmed } : {}) })
      onDone()
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Atendimento não concluído") }
    finally { setPending(false); onBusy?.(false) }
  }

  return <div className="space-y-4">
    <fieldset disabled={pending} className="space-y-4">
      {person ? <section className="rounded-lg bg-secondary/50 p-3 text-sm"><p className="font-medium">{person.name}</p><p className="text-muted-foreground">CPF: {person.cpfCnpj}</p>{!identityLocked && <Button type="button" variant="link" className="h-auto px-0" onClick={() => { setPersonId(""); setPayerId("") }}>Trocar hóspede</Button>}{paid > 0 && <p className="mt-1 text-xs text-muted-foreground">Há recebimentos: titular e pagador estão protegidos.</p>}</section> : <div><Label>Buscar ou cadastrar hóspede</Label><CustomerCombobox ariaLabel="Buscar ou cadastrar hóspede" purpose="guest" value={personId} onChange={(id, _name, selected) => { const p = selected ?? customers.find(c => c.id === id); setPersonId(id); setPayerId(suggestPayerId(p, customers)) }} /></div>}
      {identityLocked ? <p className="text-sm">Responsável: <strong>{customers.find(c => c.id === payerId)?.name ?? "Revise o pagador"}</strong></p> : <LodgingPayerChoice person={person} people={customers} payerId={payerId} onChange={setPayerId} />}
      {locked && can("reservations.edit") && <Button variant="outline" size="sm" onClick={() => { setMode("edit"); setCompleted(false); setArrival(reservation.checkIn) }}>Editar condições da reserva</Button>}
      {profile && <details className="text-sm"><summary className="cursor-pointer">Histórico do hóspede</summary><p>{profile.totalStays} hospedagens · {profile.noShows} ausências</p></details>}
      <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="booking-arrival">{mode === "checkin" ? "Chegada efetiva" : "Entrada prevista"}</Label><Input id="booking-arrival" type="date" value={arrival} min={locked ? reservation.checkIn : undefined} onChange={e => { setArrival(e.target.value); setKeepAgreement(false) }} /></div><div><Label htmlFor="booking-departure">Saída{locked ? " prevista" : completed ? " efetiva" : ""}</Label><Input id="booking-departure" type="date" readOnly={locked} value={!reservation && completed ? actualDeparture : departure} onChange={e => { if (!reservation && completed) { setActualDeparture(e.target.value); setKeepAgreement(false) } else setDeparture(e.target.value) }} /></div></div>
      {mode === "checkin" && arrival > businessDay() && <div role="status" className="rounded border p-3 text-sm"><p>Entradas futuras devem ser reservas.</p>{reservation ? can("reservations.edit") ? <Button variant="outline" onClick={() => { setMode("edit"); setCompleted(false); setReceive(false) }}>Reagendar esta reserva</Button> : <p>Solicite a um usuário autorizado a edição das datas desta reserva.</p> : can("reservations.create") ? <Button variant="outline" onClick={() => { setMode("reservation"); setCompleted(false) }}>Criar reserva para essa data</Button> : <p>Solicite a um usuário autorizado a criação da reserva.</p>}</div>}
      {mode === "checkin" && can("hospitality.checkin.backdate") && <details className="rounded border p-3 text-sm"><summary className="cursor-pointer">Opções de data e lançamento retroativo</summary><p className="my-2 text-muted-foreground">Para uma entrada esquecida, informe acima a chegada real anterior. Os recebimentos serão registrados agora.</p>{retroactive && <><Label htmlFor="booking-date-reason">Motivo do lançamento retroativo</Label><Input id="booking-date-reason" maxLength={500} value={dateReason} onChange={e => setDateReason(e.target.value)} />{can("hospitality.checkout") && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={completed} onChange={e => { setCompleted(e.target.checked); setKeepAgreement(false); if (e.target.checked) setActualDeparture(departure <= businessDay() ? departure : businessDay()) }} />Registrar hospedagem já encerrada</label>}{completed && <p>Informe a saída efetiva. As datas contratadas da reserva e o ocupante atual do quarto serão preservados.</p>}</>}</details>}
      {locked && completed && <div className="space-y-2"><Label htmlFor="booking-actual-departure">Saída efetiva</Label><Input id="booking-actual-departure" type="date" max={businessDay()} value={actualDeparture} onChange={e => { setActualDeparture(e.target.value); setKeepAgreement(false) }} /><p className="text-xs text-muted-foreground">Saída prevista na reserva: {reservation.checkOut.split("-").reverse().join("/")}. O preço contratado será mantido somente após sua confirmação abaixo.</p></div>}
      {lateArrival && <div className="rounded border p-3 text-sm"><p>Entrada prevista: {reservation.checkIn.split("-").reverse().join("/")} · Chegada efetiva: {arrival.split("-").reverse().join("/")}</p><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={keepAgreement} onChange={e => setKeepAgreement(e.target.checked)} />Manter o valor contratado de {formatCurrency(reservation.totalValue)}</label><p className="text-xs text-muted-foreground">Para alterar condições, edite a reserva antes do check-in.</p></div>}
      {slots.map((slot, index) => <div key={index} className="grid grid-cols-[1fr_6rem] gap-3"><Label>Quarto<select aria-label={`Quarto ${index + 1}`} className={selectClass} value={slot.roomId || ""} disabled={locked} onChange={e => setSlots(slots.map((s, i) => i === index ? { ...s, roomId: Number(e.target.value) } : s))}><option value="">Selecione</option>{rooms.filter(r => available(r) && !slots.some((s, i) => i !== index && s.roomId === r.id)).map(r => <option key={r.id} value={r.id}>{r.number} · {r.type}</option>)}</select></Label><div><Label htmlFor={`booking-count-${index}`}>Pessoas</Label><Input id={`booking-count-${index}`} type="number" min={1} max={rooms.find(r => r.id === slot.roomId)?.capacity ?? 100} disabled={locked} value={slot.guestCount} onChange={e => setSlots(slots.map((s, i) => i === index ? { ...s, guestCount: Number(e.target.value) } : s))} /></div>{slots.length > 1 && <Button variant="ghost" onClick={() => setSlots(slots.filter((_, i) => i !== index))}>Remover quarto</Button>}</div>)}
      {roomUnavailable && <p role="alert" className="text-sm text-destructive">O quarto {selectedRoom?.number} está {selectedRoom?.status === "limpeza" ? "em limpeza" : selectedRoom?.status === "ocupado" ? "ocupado" : "indisponível"}. Prepare e libere o quarto ou edite a reserva para outro quarto antes da entrada.</p>}
      {mode === "reservation" && <Button variant="outline" size="sm" onClick={() => setSlots([...slots, { roomId: 0, guestCount: 1 }])}>Adicionar outro quarto</Button>}
      <section className="rounded-lg border p-3 text-sm"><p className="font-semibold">Total: {formatCurrency(total)}</p>{reservation && <p>Recebido: {formatCurrency(paid)} · Saldo: {formatCurrency(balance)}</p>}{mode === "edit" && !unchanged && <p className="text-muted-foreground">Nova cotação: {formatCurrency(total)} · Diferença: {formatCurrency(total - reservation!.totalValue)}</p>}<details className="mt-2"><summary className="cursor-pointer">Composição do preço</summary>{locked ? <p>Valor confirmado na reserva: {formatCurrency(total)}.</p> : quotes.map((q, i) => <LodgingQuotePreview key={i} result={q} />)}</details></section>
      {!locked && can("lodgingTariffs.override") && <details className="text-sm"><summary className="cursor-pointer">Autorizar preço excepcional</summary><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={exception} onChange={e => setException(e.target.checked)} />Usar valor acordado por quarto</label>{exception && <div className="grid gap-3 sm:grid-cols-2"><Label>Valor (R$)<Input aria-label="Valor excepcional" type="number" min={0} step="0.01" value={exceptionValue} onChange={e => setExceptionValue(e.target.value)} /></Label><Label>Motivo<Input aria-label="Motivo do preço excepcional" value={priceReason} onChange={e => setPriceReason(e.target.value)} /></Label></div>}</details>}
      {mode !== "edit" && can("hospitality.receive") && balance > 0 && <section className="rounded border p-3 text-sm"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={receive} onChange={e => setReceive(e.target.checked)} />Receber agora (opcional)</label>{receive && <div className="space-y-3"><Label>Valor a receber<Input aria-label="Valor a receber" type="number" min="0.01" step="0.01" max={balance} placeholder={String(balance)} value={amount} onChange={e => setAmount(e.target.value)} /></Label>{mixed ? <PaymentEditor total={receiving} lines={lines} onChange={setLines} /> : <PaymentFields method={method} setMethod={setMethod} accountId={accountId} setAccountId={setAccountId} />}<Button variant="outline" size="sm" onClick={() => { setMixed(!mixed); setLines([{ method, value: receiving, accountId: accountId || (bankAccounts.filter(a => a.active).length === 1 ? bankAccounts.find(a => a.active)?.id : undefined) }]) }}>{mixed ? "Usar uma forma" : "Dividir pagamento"}</Button>{needsCash && <div role="status"><p>Abra o caixa para receber em dinheiro.</p><CashTurnShortcut /></div>}<p>Saldo após receber: {formatCurrency(balance - receiving)}.</p></div>}</section>}
      {completed && balance > receiving && <section className="space-y-3 rounded border p-3 text-sm"><p>A saída com saldo exige empresa pagadora e autorização de cobrança a prazo.</p><Label>Vencimento<Input aria-label="Vencimento da hospedagem" type="date" min={businessDay()} value={dueDate} onChange={e => setDueDate(e.target.value)} /></Label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={creditConfirmed} onChange={e => setCreditConfirmed(e.target.checked)} />Confirmar cobrança a prazo da empresa</label></section>}
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background py-3"><Button data-slot="dialog-close" variant="outline" disabled={pending} onClick={onDone}>Voltar</Button><Button disabled={pending || needsCash || roomUnavailable || !person || mode === "checkin" && arrival > businessDay()} onClick={confirm}>{pending ? "Registrando…" : mode === "edit" ? "Salvar reserva" : mode === "reservation" ? "Confirmar reserva" : completed ? "Registrar hospedagem encerrada" : "Confirmar entrada"}</Button></div>
  </div>
}
