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
  const { cashCloses, runOperation } = useApp()
  const { can, user } = useAuth()
  const active = cashCloses.find(session => session.status === "aberto")
  const [opening, setOpening] = useState("0"), [physical, setPhysical] = useState("")
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [closed, setClosed] = useState<CashClose | null>(null)
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
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button disabled={!can(active ? "cash.close" : "cash.open") || (!!active && active.responsibleUserId !== user?.id && !can("cash.closeAny")) || pending || (active ? physical === "" : opening === "")} onClick={submit}>{pending ? "Registrando..." : active ? "Confirmar fechamento" : "Abrir caixa"}</Button>
    {closed && <div role="status" className="rounded bg-secondary p-3 text-sm">Fechamento registrado. Esperado: R$ {closed.expectedValue.toFixed(2)}. Contado: R$ {closed.physicalValue.toFixed(2)}. Divergência: R$ {closed.divergence.toFixed(2)}.</div>}
  </div>
}
