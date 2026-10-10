"use client"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { PaymentDialog } from "./payment-fields"

type Target = { accountReceivableId: string; recordVersion: number; value: number; installmentId?: string }
export function BatchReceiptsPanel() {
  const { accountsReceivable, runOperation } = useApp()
  const [selected, setSelected] = useState<Record<string, Target>>({})
  const [open, setOpen] = useState(false)
  const candidates = accountsReceivable.filter(a => ['pendente', 'vencido'].includes(a.status))
  const targets = Object.values(selected)
  const total = Math.round(targets.reduce((sum, t) => sum + t.value, 0) * 100) / 100
  return <details className="mb-4 rounded border p-3"><summary className="cursor-pointer font-medium">Receber vários títulos juntos</summary>
    <p className="my-3 text-sm text-muted-foreground">Selecione uma parcela por título e informe quanto receber. O mesmo pagamento será distribuído sem duplicar entradas.</p>
    <fieldset disabled={open} className="grid gap-3">{candidates.map(a => {
      const parts = (a.installments ?? []).filter(p => p.status !== 'pago')
      const target = selected[a.id], part = parts.find(p => p.id === target?.installmentId) ?? parts[0]
      const balance = Number(((part?.value ?? a.value) - (part?.paidValue ?? a.paidValue ?? 0)).toFixed(2))
      const makeTarget = (value: number, installmentId = part?.id): Target => ({ accountReceivableId: a.id, recordVersion: a.recordVersion ?? 0, value, installmentId })
      return <div key={a.id} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
        <label className="flex gap-2"><input type="checkbox" checked={!!target} onChange={e => setSelected(old => { const next = { ...old }; if (e.target.checked) next[a.id] = makeTarget(balance); else delete next[a.id]; return next })} />{a.customerName} · {a.description}</label>
        {parts.length > 0 && <label>Parcela<select aria-label={`Parcela de ${a.description}`} disabled={!target} value={part?.id ?? ''} className="min-h-11 w-full rounded border bg-background" onChange={e => { const p = parts.find(p => p.id === e.target.value)!; setSelected(old => ({ ...old, [a.id]: makeTarget(Number((p.value - (p.paidValue ?? 0)).toFixed(2)), p.id) })) }}>{parts.map(p => <option key={p.id} value={p.id}>{p.installmentNumber} · saldo R$ {(p.value - (p.paidValue ?? 0)).toFixed(2)}</option>)}</select></label>}
        <label>Valor (saldo R$ {balance.toFixed(2)})<Input aria-label={`Receber de ${a.description}`} disabled={!target} type="number" min="0.01" max={balance} step="0.01" value={target?.value ?? ''} onChange={e => setSelected(old => ({ ...old, [a.id]: { ...target!, value: Number(e.target.value) } }))} /></label>
      </div>
    })}</fieldset>
    <Button className="mt-3" disabled={!targets.length || targets.length > 30 || targets.some(t => !Number.isFinite(t.value) || t.value <= 0)} onClick={() => setOpen(true)}>Receber R$ {total.toFixed(2)}</Button>
    {open && <PaymentDialog open title="Recebimento distribuído" maximum={total} fixedAmount mixedEnabled onClose={() => setOpen(false)} onConfirm={async (paymentMethod, accountId, _value, payments) => { await runOperation('receive-batch', { targets, paymentMethod, accountId, payments }); setSelected({}) }} />}
  </details>
}

