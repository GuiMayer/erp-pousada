"use client"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useApp } from "@/lib/app-context"
import { getDataConfig } from "@/lib/data/config"
import type { CashClose } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function CashSessionPanel() {
  const { cashCloses, bankAccounts, runOperation } = useApp()
  const { can, user } = useAuth()
  const active = cashCloses.find(session => session.status === "aberto")
  const [opening, setOpening] = useState("0"), [physical, setPhysical] = useState("")
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [closed, setClosed] = useState<CashClose | null>(null)
  const [direction, setDirection] = useState("supply"), [movementValue, setMovementValue] = useState(""), [accountId, setAccountId] = useState(""), [reason, setReason] = useState(""), [message, setMessage] = useState("")
  async function move() {
    if (pending) return
    setPending(true); setError(""); setMessage("")
    try { await runOperation("cash-movement", { direction, value: Number(movementValue), accountId, reason }); setMovementValue(""); setReason(""); setMessage(direction === "supply" ? "Suprimento registrado: dinheiro entrou no caixa e saiu da conta escolhida." : "Sangria registrada: dinheiro saiu do caixa e entrou na conta escolhida.") }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Movimentação não concluída") }
    finally { setPending(false) }
  }
  if (getDataConfig().adapter !== "database") return <p>O controle de turnos com conciliação está disponível no modo conectado ao banco.</p>
  async function submit() {
    if (pending) return
    setPending(true); setError("")
    try {
      if (active) {
        const result = await runOperation("cash-close", { sessionId: active.id, physicalValue: Number(physical) }) as CashClose
        setClosed(result); setPhysical("")
      } else { await runOperation("cash-open", { openingValue: Number(opening) }); setClosed(null) }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Operação não concluída") }
    finally { setPending(false) }
  }
  return <div className="mx-auto grid max-w-md gap-4 rounded-lg border p-6">
    <h3 className="font-semibold">{active ? "Fechar turno — caixa cego" : "Abrir caixa"}</h3>
    {active ? <><p className="text-sm">Responsável: {active.operator}. Aberto em {new Date(active.openedAt || active.date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Informe o dinheiro contado; o esperado será exibido após confirmar.</p><Label>Valor físico em dinheiro (R$)<Input aria-label="Valor físico em dinheiro" type="number" min="0" step="0.01" value={physical} onChange={event => setPhysical(event.target.value)} /></Label></> : <Label>Fundo inicial em dinheiro (R$)<Input aria-label="Fundo inicial em dinheiro" type="number" min="0" step="0.01" value={opening} onChange={event => setOpening(event.target.value)} /></Label>}
    {active && can("cash.move") && <details className="rounded border p-3"><summary>Suprimento ou sangria</summary><fieldset disabled={pending} className="mt-3 grid gap-3"><Label>Movimentação<select aria-label="Movimentação do caixa" className="min-h-11 w-full rounded border bg-background" value={direction} onChange={e => setDirection(e.target.value)}><option value="supply">Suprimento — entrada em dinheiro</option><option value="withdraw">Sangria — retirada em dinheiro</option></select></Label><Label>Conta de origem/destino<select aria-label="Conta do movimento" className="min-h-11 w-full rounded border bg-background" value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">Selecione</option>{bankAccounts.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Label><Label>Valor (R$)<Input aria-label="Valor do movimento" type="number" min="0.01" step="0.01" value={movementValue} onChange={e => setMovementValue(e.target.value)} /></Label><Label>Motivo<Input aria-label="Motivo do movimento" value={reason} onChange={e => setReason(e.target.value)} /></Label><Button disabled={!accountId || Number(movementValue) <= 0 || reason.trim().length < 5} onClick={move}>Registrar movimentação</Button></fieldset>{message && <p role="status" className="mt-3 text-sm">{message}</p>}</details>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button disabled={!can(active ? "cash.close" : "cash.open") || (!!active && active.responsibleUserId !== user?.id && !can("cash.closeAny")) || pending || (active ? physical === "" : opening === "")} onClick={submit}>{pending ? "Registrando..." : active ? "Confirmar fechamento" : "Abrir caixa"}</Button>
    {closed && <div role="status" className="rounded bg-secondary p-3 text-sm">Fechamento registrado. Esperado: R$ {closed.expectedValue.toFixed(2)}. Contado: R$ {closed.physicalValue.toFixed(2)}. Divergência: R$ {closed.divergence.toFixed(2)}.</div>}
  </div>
}
