"use client"
import { CashSummaryView } from "./cash-summary-view"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useApp } from "@/lib/app-context"
import { ApiError } from "@/lib/data/conflicts"
import type { CashClose } from "@/lib/store"
import { formatCurrency } from "@/lib/utils/formatters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type CashTask = "open" | "close" | "move"
const numberField = { type: "number", min: "0", step: "0.01" } as const

export type CashTurnReceipt = CashClose & { incomingValue?: number; outgoingValue?: number }
export function CashReceipt({ turn }: { turn: CashTurnReceipt }) {
  return <div className="grid gap-2 rounded-lg border bg-secondary/40 p-4 text-sm">
    <p className="font-semibold">Fechamento registrado</p>
    {turn.closingSummary && <CashSummaryView summary={turn.closingSummary} />}
    <p className="font-semibold">Conferência do dinheiro</p>
    <dl className="grid grid-cols-2 gap-2">
      <dt>Fundo inicial</dt><dd className="text-right">{formatCurrency(turn.openingValue ?? 0)}</dd>
      {turn.incomingValue !== undefined && <><dt>Entradas em dinheiro</dt><dd className="text-right">{formatCurrency(turn.incomingValue)}</dd><dt>Saídas em dinheiro</dt><dd className="text-right">{formatCurrency(turn.outgoingValue ?? 0)}</dd></>}
      <dt>Esperado antes da retirada</dt><dd className="text-right">{formatCurrency(turn.expectedValue)}</dd>
      <dt>Dinheiro contado</dt><dd className="text-right">{formatCurrency(turn.physicalValue)}</dd>
      <dt>Diferença</dt><dd className={`text-right ${turn.divergence ? "font-semibold text-destructive" : ""}`}>{formatCurrency(turn.divergence)}</dd>
      <dt>Fundo para próximo turno</dt><dd className="text-right">{formatCurrency(turn.retainedValue ?? 0)}</dd>
      <dt>Retirada</dt><dd className="text-right">{formatCurrency(turn.withdrawnValue ?? 0)}</dd>
    </dl>
    {(turn.withdrawnValue ?? 0) === 0 ? <p>Não houve retirada em espécie.</p> : <p>Destino da retirada: {turn.withdrawalAccountId ? "depósito em conta registrado" : "retirada em espécie sob responsabilidade de quem fechou"}.</p>}
    {turn.closingReason && <p>Justificativa: {turn.closingReason}</p>}
    {turn.closedBy && <p>Fechado por: {turn.closedBy}</p>}
  </div>
}

export function CashSessionPanel({ mode = "open", onPendingChange, onOpened, onCompleted }: { onCompleted?: () => void; mode?: CashTask; onPendingChange?: (pending: boolean) => void; onOpened?: () => void } = {}) {
  const { cashCloses = [], bankAccounts = [], runOperation } = useApp()
  const { can, user } = useAuth()
  const active = cashCloses.find(session => session.status === "aberto")
  const previous = cashCloses.filter(session => session.status === "fechado").sort((a, b) => (b.closedAt ?? b.date).localeCompare(a.closedAt ?? a.date))[0]
  const [sessionId] = useState(active?.id)
  const [preview, setPreview] = useState<CashTurnReceipt | null>(null)
  const [opening, setOpening] = useState(String(previous?.retainedValue ?? 0))
  const [openingReason, setOpeningReason] = useState("")
  const [physical, setPhysical] = useState(""), [retained, setRetained] = useState("")
  const [closingReason, setClosingReason] = useState(""), [needsReason, setNeedsReason] = useState(false)
  const [deposit, setDeposit] = useState(false), [depositAccount, setDepositAccount] = useState("")
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [closed, setClosed] = useState<CashTurnReceipt | null>(null)
  const [direction, setDirection] = useState("supply"), [movementValue, setMovementValue] = useState(""), [accountId, setAccountId] = useState(""), [reason, setReason] = useState(""), [message, setMessage] = useState("")
  useEffect(() => { onPendingChange?.(pending) }, [pending, onPendingChange])
  const changedOpening = !!previous && Number(opening) !== (previous.retainedValue ?? 0)
  const canClose = !!active && can("cash.close") && (active.responsibleUserId === user?.id || can("cash.closeAny"))
  const withdrawn = Math.round((Number(physical) - Number(retained || physical)) * 100) / 100
  const depositing = deposit && withdrawn > 0
  async function submit() {
    if (pending) return
    setPending(true); setError(""); setMessage("")
    try {
      if (mode !== "open" && (!sessionId || active?.id !== sessionId)) throw Error("O turno mudou. Feche esta janela e confira o estado do caixa.")
      if (mode === "move") {
        await runOperation("cash-movement", { direction, value: Number(movementValue), accountId, reason })
        onCompleted?.(); setMovementValue(""); setReason(""); setMessage(direction === "supply" ? "Suprimento registrado: dinheiro entrou no caixa e saiu da conta escolhida." : "Sangria registrada: dinheiro saiu do caixa e entrou na conta escolhida.")
      } else if (mode === "close") {
        if (!preview) {
          const current = await runOperation<CashTurnReceipt>("cash-preview", { sessionId })
          setPreview(current); setNeedsReason(Math.round(Number(physical) * 100) !== Math.round((current.closingSummary?.expectedValue ?? current.expectedValue) * 100))
          return
        }
        const result = await runOperation<CashTurnReceipt>("cash-close", { sessionId, recordVersion: preview.recordVersion, physicalValue: Number(physical), retainedValue: Number(retained || physical), ...(depositing ? { withdrawalAccountId: depositAccount } : {}), ...(closingReason.trim() ? { closingReason: closingReason.trim() } : {}) })
        setClosed(result); onCompleted?.()
      } else {
        await runOperation("cash-open", { openingValue: Number(opening), ...(changedOpening ? { openingReason: openingReason.trim() } : {}) })
        onOpened?.()
      }
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "CASH_CHANGED") { setPreview(null); setNeedsReason(false) }
      if (failure instanceof ApiError && failure.code === "CASH_DIFFERENCE") setNeedsReason(true)
      setError(failure instanceof Error ? failure.message : "Operação não concluída")
    } finally { setPending(false) }
  }
  if (closed) return <div role="status"><CashReceipt turn={closed} /></div>
  const invalid = mode === "open" ? !can("cash.open") || !!active || opening === "" || (changedOpening && openingReason.trim().length < 5)
    : mode === "move" ? !can("cash.move") || !active || !accountId || !(Number(movementValue) > 0) || reason.trim().length < 5
    : !canClose || physical === "" || Number(retained || physical) > Number(physical) || (depositing && !depositAccount) || (needsReason && closingReason.trim().length < 5)
  return <div className="grid gap-4">
    <fieldset disabled={pending} className="grid gap-4">
      {mode === "open" && <>
        {previous && <p className="text-sm text-muted-foreground">Fundo deixado no último fechamento: {formatCurrency(previous.retainedValue ?? 0)}. Confira o dinheiro antes de abrir.</p>}
        <Label className="flex-col items-stretch gap-2">Fundo inicial em dinheiro (R$)<Input aria-label="Fundo inicial em dinheiro" {...numberField} value={opening} onChange={e => setOpening(e.target.value)} /></Label>
        {changedOpening && <Label className="flex-col items-stretch gap-2">Motivo da alteração do fundo<Input aria-label="Motivo da alteração do fundo" maxLength={500} value={openingReason} onChange={e => setOpeningReason(e.target.value)} /></Label>}
        {active && <p role="status">Já existe um caixa aberto. Feche esta janela para conferir o turno.</p>}
      </>}
      {mode === "close" && <>
        <p className="text-sm text-muted-foreground">Conte somente o dinheiro físico. PIX e cartões aparecem separados no resumo do atendimento. Clique em Conferir para comparar os valores antes de fechar.</p>
        <Label className="flex-col items-stretch gap-2">Valor físico em dinheiro (R$)<Input aria-label="Valor físico em dinheiro" {...numberField} value={physical} onChange={e => { setPhysical(e.target.value); setPreview(null); setNeedsReason(false) }} /></Label>
        <Label className="flex-col items-stretch gap-2">Fundo para o próximo turno (R$)<Input aria-label="Fundo para o próximo turno" {...numberField} placeholder={physical || "Todo o dinheiro contado"} value={retained} onChange={e => setRetained(e.target.value)} /></Label>
        <p className="text-sm">Retirada em espécie: {formatCurrency(Math.max(0, withdrawn))}. Sob responsabilidade de quem fechar o caixa.</p>
        {can("cash.move") && withdrawn > 0 && <><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={deposit} onChange={e => setDeposit(e.target.checked)} />Já depositei a retirada em uma conta</label>{deposit && <Label className="flex-col items-stretch gap-2">Conta do depósito<select aria-label="Conta do depósito" className="min-h-11 w-full rounded border bg-background p-2" value={depositAccount} onChange={e => setDepositAccount(e.target.value)}><option value="">Selecione</option>{bankAccounts.filter(a => a.active && a.type !== "cartao" && a.type !== "caixa").map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Label>}</>}
        {preview?.closingSummary && <>
          <CashSummaryView summary={preview.closingSummary} />
          <div role="status" className="rounded-lg border p-3 text-sm"><p className="font-semibold">Conferência do dinheiro</p><p>Fundo inicial: {formatCurrency(preview.openingValue ?? 0)}</p><p>Entradas em espécie: {formatCurrency(preview.closingSummary.incomingValue)}</p><p>Saídas em espécie: {formatCurrency(preview.closingSummary.outgoingValue)}</p><p>Esperado: {formatCurrency(preview.closingSummary.expectedValue)}</p><p>Contado: {formatCurrency(Number(physical))}</p><p className={needsReason ? "font-semibold text-destructive" : ""}>Diferença: {formatCurrency(Number(physical) - preview.closingSummary.expectedValue)}</p></div>
          {!needsReason && <Button variant="outline" onClick={() => { setPreview(null); setPhysical(""); setError("") }}>Recontar dinheiro</Button>}
        </>}
        {needsReason && <><Label className="flex-col items-stretch gap-2">Justificativa da diferença<Input aria-label="Justificativa da diferença" maxLength={500} value={closingReason} onChange={e => setClosingReason(e.target.value)} /></Label><Button variant="outline" onClick={() => { setNeedsReason(false); setPreview(null); setClosingReason(""); setPhysical(""); setError("") }}>Recontar dinheiro</Button></>}
        {!canClose && <p className="text-sm text-muted-foreground">Somente o responsável ou alguém autorizado pode fechar este turno.</p>}
      </>}
      {mode === "move" && <>
        <Label className="flex-col items-stretch gap-2">Movimentação<select aria-label="Movimentação do caixa" className="min-h-11 w-full rounded border bg-background p-2" value={direction} onChange={e => setDirection(e.target.value)}><option value="supply">Suprimento — entrada em dinheiro</option><option value="withdraw">Sangria — retirada em dinheiro</option></select></Label>
        <Label className="flex-col items-stretch gap-2">Conta de origem/destino<select aria-label="Conta do movimento" className="min-h-11 w-full rounded border bg-background p-2" value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">Selecione</option>{bankAccounts.filter(a => a.active && a.type !== "cartao" && a.type !== "caixa").map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Label>
        <Label className="flex-col items-stretch gap-2">Valor (R$)<Input aria-label="Valor do movimento" {...numberField} min="0.01" value={movementValue} onChange={e => setMovementValue(e.target.value)} /></Label>
        <Label className="flex-col items-stretch gap-2">Motivo<Input aria-label="Motivo do movimento" maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></Label>
      </>}
    </fieldset>
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button disabled={pending || !!invalid} onClick={submit}>{pending ? "Registrando..." : mode === "close" ? preview ? "Confirmar fechamento" : "Conferir fechamento" : mode === "move" ? "Registrar movimentação" : "Abrir caixa"}</Button>
  </div>
}
