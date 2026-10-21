"use client"
import { useState } from "react"
import type { Reservation } from "@/lib/store"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { cancellationAmounts, type CancellationDecision } from "@/lib/booking-flow"
import { formatCurrency } from "@/lib/utils/formatters"
import { normalizePayment } from "@/lib/utils/business-values"
import { getDataConfig } from "@/lib/data/config"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Label } from "./ui/label"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { CashTurnShortcut } from "./cash-turn-shortcut"

export function ReservationCancellationDialog({ reservation: r, noShow, onClose }: { reservation: Reservation; noShow: boolean; onClose: () => void }) {
  const { runOperation, transactions, cashCloses, bankAccounts, customers, guests } = useApp()
  const { can, canRequest } = useAuth()
  const received = r.paidValue ?? 0
  const [decision, setDecision] = useState<CancellationDecision>("refund")
  const [partial, setPartial] = useState(false), [refund, setRefund] = useState(String(received))
  const [reason, setReason] = useState(""), [financialReason, setFinancialReason] = useState("")
  const [pending, setPending] = useState(false), [error, setError] = useState("")
  let amounts = { refund: 0, retained: 0, credit: 0 }, invalid = false
  try { amounts = cancellationAmounts(received, decision, partial ? Number(refund) : undefined) } catch { invalid = true }
  const needsFinancialReason = amounts.retained > 0 || amounts.credit > 0
  let toReturn = Math.round(amounts.refund * 100)
  const origins = transactions.filter(t => t.refId === `Hospedagem ${r.id}` && ["receita", "credito_utilizado"].includes(t.type)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).filter(t => {
    const alreadyReturned = transactions.filter(p => p.reversalOfId === t.id).reduce((sum, p) => sum + Math.round(p.value * 100), 0)
    const value = Math.min(toReturn, Math.max(0, Math.round(t.value * 100) - alreadyReturned))
    toReturn -= value
    return value > 0
  })
  const cashRefund = origins.some(t => t.type === "receita" && normalizePayment(t.paymentMethod ?? "") === "Dinheiro")
  const needsCash = cashRefund && !cashCloses.some(c => c.status === "aberto")
  const personalCredit = guests.find(g => g.cpf === r.cpf)?.customerId === r.payerId
  const mayCancelPaid = getDataConfig().adapter === "database" && canRequest ? canRequest("reservations.paidCancel") : can("reservations.paidCancel")
  const authorized = can("reservations.cancel") && (!received || mayCancelPaid) && (!needsFinancialReason || can("reservations.feeCredit"))
  async function confirm() {
    if (pending || needsCash || invalid || !authorized) return
    setError("")
    if (needsFinancialReason && financialReason.trim().length < 5) { setError("Informe a justificativa financeira, com pelo menos 5 caracteres"); return }
    setPending(true)
    try {
      await runOperation("cancel-reservation", { reservationId: r.id, recordVersion: r.recordVersion, status: noShow ? "noshow" : "cancelada", decision, ...(partial ? { refundValue: Number(refund) } : {}), cancellationReason: reason.trim() || undefined, financialReason: needsFinancialReason ? financialReason.trim() : undefined })
      onClose()
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Cancelamento não concluído") }
    finally { setPending(false) }
  }
  return <Dialog open onOpenChange={v => { if (!v && !pending) onClose() }}><DialogContent mobileTask protectDraft busy={pending} className="sm:max-w-lg"><DialogHeader><DialogTitle>{noShow ? "Registrar ausência" : "Cancelar reserva"}</DialogTitle><DialogDescription>{r.guestName} · Quarto {r.roomNumber}. Esta ação libera o período reservado.</DialogDescription></DialogHeader>
    <fieldset disabled={pending} className="space-y-4">
      <div className="rounded border p-3 text-sm"><p>Contratado: {formatCurrency(r.totalValue)}</p><p>Recebido e disponível: {formatCurrency(received)}</p>{!received && <p className="mt-2">Nenhum valor recebido. Não há devolução.</p>}</div>
      {received > 0 && <><fieldset className="space-y-1"><legend className="text-sm font-medium">Devolver o valor recebido?</legend><label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="cancellation-decision" checked={decision === "refund"} onChange={() => setDecision("refund")} />Sim, devolver à origem do pagamento</label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="cancellation-decision" checked={decision === "retain"} disabled={!can("reservations.feeCredit")} onChange={() => setDecision("retain")} />Não, reter o valor recebido</label></fieldset>
        {can("reservations.feeCredit") && <details className="rounded border p-3 text-sm"><summary className="cursor-pointer">Outras tratativas</summary>{decision === "refund" && <><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={partial} onChange={e => setPartial(e.target.checked)} />Devolver apenas parte do valor</label>{partial && <Label>Valor a devolver<Input aria-label="Valor a devolver" type="number" min={0} max={received} step="0.01" value={refund} onChange={e => setRefund(e.target.value)} /></Label>}</>}<label className="flex min-h-11 items-center gap-2"><input type="radio" name="cancellation-decision" checked={decision === "credit"} disabled={!personalCredit} onChange={() => { setDecision("credit"); setPartial(false) }} />Transformar em crédito para o hóspede</label>{!personalCredit && <p className="text-xs text-muted-foreground">Crédito pessoal exige que o próprio hóspede seja o pagador.</p>}</details>}
        {!invalid && <p className="text-sm">Devolver: {formatCurrency(amounts.refund)} · Reter: {formatCurrency(amounts.retained)}{amounts.credit > 0 && ` · Crédito: ${formatCurrency(amounts.credit)}`}</p>}
        {amounts.refund > 0 && <div className="text-sm text-muted-foreground"><p>A devolução recompõe os meios originais. Crédito interno volta ao titular original; dinheiro exige caixa aberto com saldo.</p>{[...new Set(origins.filter(t => t.accountId).map(t => t.accountId))].map(id => <p key={id}>Conta de origem: {bankAccounts.find(a => a.id === id)?.name ?? "Revise a conta"}</p>)}<p>Responsável: {customers.find(c => c.id === r.payerId)?.name ?? r.guestName}</p></div>}
        {needsFinancialReason && <div><Label htmlFor="cancellation-financial">Justificativa financeira (obrigatória)</Label><Textarea id="cancellation-financial" maxLength={500} value={financialReason} onChange={e => setFinancialReason(e.target.value)} /></div>}
      </>}
      <div><Label htmlFor="cancellation-reason">Motivo do cancelamento (opcional)</Label><Textarea id="cancellation-reason" maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /><p className="text-right text-xs text-muted-foreground">{reason.length}/500</p></div>
    </fieldset>
    {needsCash && <div role="status" className="text-sm"><p>Abra o caixa para realizar a devolução em dinheiro.</p><CashTurnShortcut /></div>}
    {!authorized && <p role="alert" className="text-sm text-destructive">Solicite autorização para cancelar esta reserva com a decisão financeira escolhida.</p>}
    {invalid && <p role="alert" className="text-sm text-destructive">O valor da devolução deve estar entre zero e o recebido.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background py-3"><Button data-slot="dialog-close" variant="outline" disabled={pending} onClick={onClose}>Voltar</Button><Button variant="destructive" disabled={pending || needsCash || invalid || !authorized} onClick={confirm}>{pending ? "Registrando…" : !received ? "Confirmar cancelamento" : decision === "credit" ? `Cancelar e gerar ${formatCurrency(amounts.credit)} em crédito` : amounts.refund > 0 ? `Cancelar e devolver ${formatCurrency(amounts.refund)}` : `Cancelar e reter ${formatCurrency(amounts.retained)}`}</Button></div>
  </DialogContent></Dialog>
}
