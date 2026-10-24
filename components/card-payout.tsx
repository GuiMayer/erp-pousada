"use client"
import { useRef, useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { acceptsPayment, cardPayoutAmounts } from "@/lib/payment-accounts"
import { formatCurrency } from "@/lib/utils/formatters"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog"

export function CardPayout() {
  const { bankAccounts, runOperation } = useApp(), { can } = useAuth()
  const [open, setOpen] = useState(false), [source, setSource] = useState(""), [bank, setBank] = useState("")
  const [gross, setGross] = useState(""), [fee, setFee] = useState("0"), [pending, setPending] = useState(false), [error, setError] = useState("")
  const request = useRef<string | undefined>(undefined)
  const cards = bankAccounts.filter(a => a.active && a.type === "cartao"), banks = bankAccounts.filter(a => acceptsPayment(a, "PIX"))
  const net = Math.round((Number(gross) - Number(fee)) * 100) / 100
  async function submit() {
    if (pending) return
    setPending(true); setError("")
    try {
      cardPayoutAmounts(Number(gross), Number(fee))
      request.current ??= crypto.randomUUID()
      await runOperation("card-payout", { fromAccountId: source || (cards.length === 1 ? cards[0].id : ""), toAccountId: bank || (banks.length === 1 ? banks[0].id : ""), gross: Number(gross), fee: Number(fee) }, request.current)
      request.current = undefined; setOpen(false); setGross(""); setFee("0")
    } catch (e) { setError(e instanceof Error ? e.message : "Repasse não concluído") }
    finally { setPending(false) }
  }
  if (!can("bankAccounts.transfer")) return null
  return <><Button variant="outline" onClick={() => setOpen(true)}>Registrar repasse do cartão</Button><Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value) }}><DialogContent mobileTask protectDraft busy={pending}><DialogHeader><DialogTitle>Repasse do cartão</DialogTitle><DialogDescription>Confirme um repasse já recebido no banco. O valor sai de Cartões a receber; a taxa fica registrada como despesa.</DialogDescription></DialogHeader><fieldset disabled={pending} className="grid gap-3"><Label className="flex-col items-stretch gap-2">Cartões a receber<select aria-label="Origem do repasse" className="min-h-11 w-full rounded border bg-background p-2" value={source || (cards.length === 1 ? cards[0].id : "")} onChange={e => setSource(e.target.value)}><option value="">Selecione</option>{cards.map(a => <option key={a.id} value={a.id}>{a.name}{can("bankAccounts.read") ? ` · ${formatCurrency(a.currentBalance)}` : ""}</option>)}</select></Label><Label className="flex-col items-stretch gap-2">Banco de destino<select aria-label="Banco do repasse" className="min-h-11 w-full rounded border bg-background p-2" value={bank || (banks.length === 1 ? banks[0].id : "")} onChange={e => setBank(e.target.value)}><option value="">Selecione</option>{banks.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Label><Label className="flex-col items-stretch gap-2">Valor bruto (R$)<Input aria-label="Bruto do repasse" type="number" min="0.01" step="0.01" value={gross} onChange={e => setGross(e.target.value)} /></Label><Label className="flex-col items-stretch gap-2">Taxa (R$)<Input aria-label="Taxa do repasse" type="number" min="0" step="0.01" value={fee} onChange={e => setFee(e.target.value)} /></Label><p>Líquido no banco: {formatCurrency(net)}</p></fieldset>{error && <p role="alert" className="text-destructive">{error}</p>}<DialogFooter><Button disabled={pending || !gross || !fee || !cards.length || !banks.length} onClick={submit}>{pending ? "Registrando..." : "Confirmar repasse"}</Button></DialogFooter></DialogContent></Dialog></>
}
