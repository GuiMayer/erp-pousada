"use client"
import { useEffect, useRef, useState } from "react"
import { clearSnapshots, type ConflictChallenge } from "@/lib/data/conflicts"
import { useAuth } from "@/lib/auth-context"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"

const labels: Record<string, string> = { name: "Nome", fullName: "Nome completo", phone: "Telefone", email: "E-mail", address: "Endereço", notes: "Observações", number: "Número", type: "Tipo", price: "Preço", barcode: "Código de barras", active: "Ativo", categoryId: "Categoria", pousadaName: "Nome da pousada", checkInTime: "Horário de entrada", checkOutTime: "Horário de saída", discountCeiling: "Limite de desconto" }
const restricted = new Set(["expenses", "accountsReceivable", "stockItems", "bankAccounts", "users", "budgets", "recipes"])
const display = (value: unknown) => value === undefined || value === null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)
export function ConflictReview() {
  const { user } = useAuth()
  const [challenge, setChallenge] = useState<ConflictChallenge | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const pending = useRef<ConflictChallenge | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  useEffect(() => {
    const listener = (event: Event) => {
      const next = (event as CustomEvent<ConflictChallenge>).detail
      if (pending.current) { next.reject(new Error("Conclua a revisão anterior. Seu formulário permanece aberto.")); return }
      pending.current = next; setChallenge(next); setSelected([])
    }
    const status = (event: Event) => setConnected((event as CustomEvent<boolean>).detail)
    window.addEventListener("erp:conflict", listener)
    window.addEventListener("erp:sync-status", status)
    return () => {
      window.removeEventListener("erp:conflict", listener); window.removeEventListener("erp:sync-status", status)
      pending.current?.reject(new Error("Revisão encerrada. Seu rascunho não foi salvo.")); pending.current = null; clearSnapshots()
    }
  }, [user?.id])
  function cancel() { pending.current?.reject(new Error("Registro alterado. Revise os dados atuais; seu rascunho permanece no formulário.")); pending.current = null; setChallenge(null) }
  const fields = challenge ? Object.keys(challenge.draft).filter(field => field !== "recordVersion" && !["id", "cpf", "createdAt", "createdBy", "password", "permissionOverrides", "accessVersion"].includes(field)) : []
  const requiresManualReview = !!challenge && (restricted.has(challenge.key) || fields.some(field => ["status", "paidValue", "currentStock", "currentBalance", "blockEndDate", "blockReason", "blockResponsible"].includes(field)))
  function accept() {
    if (!challenge || !selected.length) return
    const result = Object.fromEntries(selected.map(field => [field, challenge.draft[field]]))
    const current = challenge; pending.current = null; setChallenge(null)
    current.resolve({ ...result, recordVersion: current.current.recordVersion })
  }
  return <>
    {connected === false && <p role="status" className="px-4 py-2 text-sm text-muted-foreground">Atualização rápida indisponível. Os dados continuam sendo consultados periodicamente.</p>}
    <Dialog open={!!challenge} onOpenChange={open => { if (!open) cancel() }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Outra pessoa alterou este registro</DialogTitle><DialogDescription>Sua edição foi preservada. Compare os dados antes de continuar. Nenhuma alteração será aplicada sem sua revisão.</DialogDescription></DialogHeader>
        {challenge && requiresManualReview && <p className="text-sm">Este cadastro exige revisão no formulário e uma nova abertura com os dados atuais. Não é permitido reaplicar valores financeiros, estoque ou permissões por esta janela.</p>}
        <div className="space-y-3">{fields.map(field => <div key={field} className="rounded border p-3 text-sm"><label className="flex items-center gap-2 font-medium">{challenge && !requiresManualReview && <input type="checkbox" checked={selected.includes(field)} onChange={event => setSelected(previous => event.target.checked ? [...previous, field] : previous.filter(value => value !== field))} />}{labels[field] ?? field}</label><p className="mt-2 break-all">Atual: {display(challenge?.current[field])}</p><p className="break-all">Sua edição: {display(challenge?.draft[field])}</p></div>)}</div>
        <DialogFooter className="flex-col sm:flex-col"><Button variant="outline" onClick={cancel}>Voltar ao meu rascunho</Button>{challenge && !requiresManualReview && <Button disabled={!selected.length} onClick={accept}>Salvar campos escolhidos</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
