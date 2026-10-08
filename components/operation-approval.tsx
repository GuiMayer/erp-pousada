"use client"
import { useEffect, useRef, useState } from "react"
import type { ApprovalChallenge } from "@/lib/data/operations-client"
import { PERMISSIONS } from "@/lib/permissions"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
export function OperationApproval() {
  const [challenge, setChallenge] = useState<ApprovalChallenge | null>(null)
  const pending = useRef<ApprovalChallenge | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const listener = (event: Event) => {
      const next = (event as CustomEvent<ApprovalChallenge>).detail
      if (pending.current) { next.reject(new Error("Conclua a aprovação pendente antes de iniciar outra")); return }
      pending.current = next; setChallenge(next); setError("")
    }
    window.addEventListener("erp:approval-required", listener)
    return () => { window.removeEventListener("erp:approval-required", listener); pending.current?.reject(new Error("A sessão mudou; aprovação cancelada")); pending.current = null }
  }, [])
  function close() { pending.current?.reject(new Error("Aprovação cancelada")); pending.current = null; setChallenge(null); setPassword(""); setUsername(""); setError("") }
  async function approve() {
    if (!challenge || busy) return
    setBusy(true); setError("")
    const current = challenge
    try {
      const response = await fetch("/api/auth/supervisor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, kind: current.kind, payload: current.payload, requestId: current.requestId, permission: current.permission, resourceHash: current.resourceHash }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Aprovação recusada")
      if (pending.current !== current) return
      pending.current = null; setChallenge(null); setPassword(""); setUsername(""); current.resolve()
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Aprovação recusada"); setPassword("") }
    finally { setBusy(false) }
  }
  return <Dialog open={!!challenge} onOpenChange={open => { if (!open) close() }}><DialogContent><DialogHeader><DialogTitle>Aprovar esta operação</DialogTitle><DialogDescription>A autorização vale por dois minutos, somente para esta operação e seus valores, e pode ser usada uma vez.</DialogDescription></DialogHeader>
    <p className="font-medium">{PERMISSIONS.find(item => item.key === challenge?.permission)?.label}</p>
    <dl className="space-y-2 rounded-lg bg-secondary p-3 text-sm">{challenge?.summary.map(item => <div key={item.label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{item.label}</dt><dd className="text-right font-medium">{item.value}</dd></div>)}</dl>
    <Label htmlFor="approver-username">Usuário responsável</Label><Input id="approver-username" autoComplete="off" value={username} onChange={event => setUsername(event.target.value)} />
    <Label htmlFor="approver-password">Senha do responsável</Label><Input id="approver-password" type="password" autoComplete="off" value={password} onChange={event => setPassword(event.target.value)} />
    {error && <p role="alert" className="text-destructive">{error}</p>}<DialogFooter><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={busy || !username || !password} onClick={approve}>{busy ? "Verificando..." : "Aprovar operação"}</Button></DialogFooter>
  </DialogContent></Dialog>
}
