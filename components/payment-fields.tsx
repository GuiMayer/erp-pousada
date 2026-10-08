"use client"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { normalizePayment } from "@/lib/utils/business-values"

export function BankAccountPicker({ method, accountId, setAccountId }: { method: string; accountId: string; setAccountId: (value: string) => void }) {
  const { bankAccounts } = useApp()
  if (normalizePayment(method) === "Dinheiro" || method === "credito_hospede") return null
  const accounts = bankAccounts.filter(account => account.active)
  return <Label>Conta bancária<select aria-label="Conta bancária" className="mt-1 w-full rounded border bg-background p-2" value={accountId || (accounts.length === 1 ? accounts[0].id : "")} onChange={event => setAccountId(event.target.value)}><option value="">Selecione uma conta</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{!accounts.length && <span className="block text-xs text-destructive">Cadastre uma conta ativa no Financeiro.</span>}</Label>
}

export function PaymentFields({ method, setMethod, accountId, setAccountId, allowCredit = false }: { method: string; setMethod: (value: string) => void; accountId: string; setAccountId: (value: string) => void; allowCredit?: boolean }) {
  const { bankAccounts } = useApp()
  const accounts = bankAccounts.filter(account => account.active)
  return <div className="grid gap-3">
    <Label>Forma de pagamento<select aria-label="Forma de pagamento" className="mt-1 w-full rounded border bg-background p-2" value={method} onChange={event => { setMethod(event.target.value); setAccountId("") }}>
      <option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="debito">Débito</option><option value="credito">Crédito</option>{allowCredit && <option value="credito_hospede">Crédito do hóspede</option>}
    </select></Label>
    {!['dinheiro', 'credito_hospede'].includes(method) && <Label>Conta bancária<select aria-label="Conta bancária" className="mt-1 w-full rounded border bg-background p-2" value={accountId || (accounts.length === 1 ? accounts[0].id : "")} onChange={event => setAccountId(event.target.value)}>
      <option value="">Selecione uma conta</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
    </select>{!accounts.length && <span className="block text-xs text-destructive">Cadastre uma conta ativa no Financeiro.</span>}</Label>}
  </div>
}

export function PaymentDialog({ open, onClose, title, maximum, allowCredit, onConfirm }: { open: boolean; onClose: () => void; title: string; maximum?: number; allowCredit?: boolean; onConfirm: (method: string, accountId: string | undefined, value: number) => Promise<void> }) {
  const [method, setMethod] = useState("pix"), [accountId, setAccountId] = useState(""), [amount, setAmount] = useState("")
  const [pending, setPending] = useState(false), [error, setError] = useState("")
  async function confirm() {
    if (pending) return
    const value = maximum === undefined ? 0 : Number(amount || maximum)
    if (maximum !== undefined && (!Number.isFinite(value) || value <= 0 || value > maximum)) { setError("Informe um valor positivo até o saldo pendente"); return }
    setPending(true); setError("")
    try { await onConfirm(method, ['dinheiro', 'credito_hospede'].includes(method) ? undefined : accountId || undefined, value); setAmount(""); onClose() }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Pagamento não concluído") }
    finally { setPending(false) }
  }
  return <Dialog open={open} onOpenChange={value => { if (!value && !pending) onClose() }}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
    {maximum !== undefined && <Label>Valor a receber (saldo: R$ {maximum.toFixed(2)})<Input aria-label="Valor a receber" type="number" min="0.01" max={maximum} step="0.01" value={amount} placeholder={maximum.toFixed(2)} onChange={event => setAmount(event.target.value)} /></Label>}
    <PaymentFields method={method} setMethod={setMethod} accountId={accountId} setAccountId={setAccountId} allowCredit={allowCredit} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button disabled={pending} onClick={confirm}>{pending ? "Registrando..." : "Confirmar pagamento"}</Button></DialogFooter>
  </DialogContent></Dialog>
}
