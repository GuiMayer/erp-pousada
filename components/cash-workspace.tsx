"use client"
import { usePhoneLayout } from "@/hooks/use-phone-layout"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./ui/dropdown-menu"
import { useState, useRef } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { getDataConfig } from "@/lib/data/config"
import { businessDay } from "@/lib/utils/business-values"
import { formatCurrency } from "@/lib/utils/formatters"
import { CashTaskDialog } from "./cash-turn-shortcut"
import { CashReceipt, type CashTask, type CashTurnReceipt } from "./cash-session-panel"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"

const dateTime = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })

export function CashWorkspace({ onSalesHistory }: { onSalesHistory?: () => void }) {
  const phone = usePhoneLayout()
  const { cashCloses = [], runOperation } = useApp(), { can, user } = useAuth()
  const [task, setTask] = useState<CashTask | null>(null)
  const [history, setHistory] = useState(false), [selected, setSelected] = useState<CashTurnReceipt | null>(null)
  const [note, setNote] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState("")
  const requestSequence = useRef(0)
  const active = cashCloses.find(s => s.status === "aberto")
  const closed = cashCloses.filter(s => s.status === "fechado").sort((a, b) => (b.closedAt ?? b.date).localeCompare(a.closedAt ?? a.date))
  async function inspect(id: string) {
    const sequence = ++requestSequence.current
    setError(""); setSelected(null); setNote(""); setPending(true)
    try {
      if (getDataConfig().adapter === "demo-localStorage") {
        const data = await runOperation<CashTurnReceipt>("cash-inspect", { sessionId: id })
        if (sequence === requestSequence.current) setSelected(data)
        return
      }
      const response = await fetch(`/api/cash/turns/${encodeURIComponent(id)}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw Error(data.error || "Não foi possível consultar o turno")
      if (sequence === requestSequence.current) setSelected(data)
    } catch (failure) { if (sequence === requestSequence.current) setError((failure as Error).message) }
    finally { if (sequence === requestSequence.current) setPending(false) }
  }
  async function review() {
    if (!selected || pending) return
    setPending(true); setError("")
    try { const result = await runOperation<CashTurnReceipt>("cash-review", { sessionId: selected.id, note }); setSelected({ ...selected, ...result }); setNote("") }
    catch (failure) { setError((failure as Error).message) }
    finally { setPending(false) }
  }
  return <section aria-label="Controle do caixa" className="cash-workspace rounded-lg border bg-card p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="font-semibold">{active ? "Caixa aberto" : "Caixa fechado"}</p><p className="text-sm text-muted-foreground">{active ? `${active.operator} · aberto em ${dateTime(active.openedAt ?? active.date)}` : "Abra para vender e lançar bebidas na hospedagem."}</p></div>
      <div className="flex flex-wrap gap-2">
        {!active && can("cash.open") && <Button onClick={() => setTask("open")}>Abrir caixa</Button>}

        {active && can("cash.close") && (active.responsibleUserId === user?.id || can("cash.closeAny")) && <Button onClick={() => setTask("close")}>Fechar caixa</Button>}
        {phone ? (active && can("cash.move") || can("cashCloses.read") || onSalesHistory) && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline">Mais ações do caixa</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
          {active && can("cash.move") && <DropdownMenuItem onSelect={() => setTask("move")}>Movimentar caixa</DropdownMenuItem>}
          {can("cashCloses.read") && <DropdownMenuItem onSelect={() => setHistory(true)}>Turnos anteriores</DropdownMenuItem>}
          {onSalesHistory && <DropdownMenuItem onSelect={onSalesHistory}>Histórico de vendas</DropdownMenuItem>}
        </DropdownMenuContent></DropdownMenu> : <>
          {active && can("cash.move") && <Button variant="outline" onClick={() => setTask("move")}>Movimentar</Button>}
          {can("cashCloses.read") && <Button variant="outline" onClick={() => setHistory(true)}>Turnos anteriores</Button>}
          {onSalesHistory && <Button variant="outline" onClick={onSalesHistory}>Histórico de vendas</Button>}
        </>}
      </div>
    </div>
    {active && businessDay(active.openedAt ?? active.date) < businessDay() && <p role="status" className="mt-3 rounded border border-warning/40 bg-warning/10 p-2 text-sm">Este caixa está aberto desde um dia anterior. Confira os movimentos e faça a passagem de turno.</p>}
    {active && can("cash.close") && active.responsibleUserId !== user?.id && !can("cash.closeAny") && <p className="mt-2 text-sm text-muted-foreground">O fechamento deve ser feito por {active.operator} ou por um usuário autorizado.</p>}
    {task && <CashTaskDialog task={task} onClose={() => setTask(null)} />}
    <Dialog open={history} onOpenChange={open => { if (!pending) { setHistory(open); if (!open) { setSelected(null); setError("") } } }}><DialogContent mobileTask busy={pending} className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Turnos anteriores</DialogTitle><DialogDescription>Confira fechamentos, retiradas e diferenças de caixa.</DialogDescription></DialogHeader>
      {!closed.length && <p className="text-sm text-muted-foreground">Nenhum turno encerrado.</p>}
      <div className="grid max-h-60 gap-2 overflow-y-auto">{closed.map(turn => <Button key={turn.id} variant="outline" disabled={pending} className="h-auto justify-between gap-3 whitespace-normal py-3 text-left" onClick={() => void inspect(turn.id)}><span>{turn.operator}<span className="block text-xs text-muted-foreground">{dateTime(turn.openedAt ?? turn.date)} → {dateTime(turn.closedAt ?? turn.date)}</span></span><span className={turn.divergence ? "text-destructive" : "text-muted-foreground"}>{turn.divergence ? `${formatCurrency(turn.divergence)} · ${turn.reviewedAt ? "conferido" : "a conferir"}` : "Sem diferença"}</span></Button>)}</div>
      {pending && <p role="status">Consultando ou registrando...</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {selected && <><CashReceipt turn={selected} />{selected.reviewedAt ? <p className="text-sm">Conferido por {selected.reviewedBy} em {dateTime(selected.reviewedAt)}. {selected.reviewNote}</p> : !!selected.divergence && can("cash.review") && <div className="grid gap-3"><Label>Observação da conferência<Input aria-label="Observação da conferência" value={note} maxLength={500} disabled={pending} onChange={e => setNote(e.target.value)} /></Label><Button disabled={pending || note.trim().length < 5} onClick={review}>Marcar diferença como conferida</Button></div>}</>}
    </DialogContent></Dialog>
  </section>
}
