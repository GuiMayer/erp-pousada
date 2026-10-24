"use client"
import { useState } from "react"
import { usePhoneLayout } from "@/hooks/use-phone-layout"
import { usePOSViewport } from "@/hooks/use-pos-viewport"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { distributePayment, type PaymentLine } from "@/lib/payments"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { PaymentEditor } from "./payment-editor"
import { formatCurrency } from "@/lib/utils/formatters"
import { CashTurnShortcut } from "./cash-turn-shortcut"
export type CheckoutSelection = { customer?: string; payments?: PaymentLine[]; stayId?: string; stayVersion?: number }
export function POSCheckoutDialog({ total, initialStayId = "", onClose, onConfirm }: { total: number; initialStayId?: string; onClose: () => void; onConfirm: (selection: CheckoutSelection) => Promise<void> }) {
  const { stays = [], rooms = [], cashCloses = [] } = useApp(), { can } = useAuth()
  const phone = usePhoneLayout(), viewportStyle = usePOSViewport(phone)
  const [route, setRoute] = useState("counter"), [stayId, setStayId] = useState(initialStayId)
  const [stayVersion, setStayVersion] = useState<number | undefined>(() => stays.find(s => s.id === initialStayId)?.recordVersion)
  const [editGuest, setEditGuest] = useState(!initialStayId)
  const [lines, setLines] = useState<PaymentLine[]>([{ method: "dinheiro", value: total }])
  const [pending, setPending] = useState(false), [error, setError] = useState("")
  const eligible = can("stays.read") ? stays.filter(s => s.status === "active") : [], chosen = eligible.find(s => s.id === stayId)
  const allowStay = can("consumptions.create") && can("stays.read")
  const needsCash = !cashCloses.some(turn => turn.status === "aberto")
  async function submit() {
    if (pending || needsCash) return
    setError("")
    try {
      if (route === "counter") distributePayment(total, lines)
      else if (!allowStay || !chosen) throw Error("Selecione uma hospedagem ativa autorizada")
      setPending(true)
      await onConfirm(route === "counter" ? { payments: lines, ...(chosen ? { customer: chosen.guestName } : {}) } : { stayId: chosen!.id, stayVersion })
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível confirmar a venda") }
    finally { setPending(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose() }}>
    <DialogContent mobileTask protectDraft busy={pending} className="pos-checkout sm:max-w-lg" style={viewportStyle}>
      <DialogHeader><DialogTitle>Confirmar entrega e cobrança</DialogTitle><DialogDescription>Total: {formatCurrency(total)}. Confira como será cobrada a venda.</DialogDescription></DialogHeader>
      <fieldset disabled={pending} className="space-y-4">
        <Label className="flex-col items-stretch gap-2">Como cobrar<select aria-label="Como cobrar" value={route} onChange={event => setRoute(event.target.value)} className="mt-1 min-h-11 w-full rounded border bg-background px-2"><option value="counter">Receber agora (não lançar na ficha)</option>{allowStay && <option value="stay">Marcar na ficha de consumo</option>}</select></Label>
        {chosen && !editGuest && <div aria-label="Hospedagem selecionada" className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"><span>Quarto {rooms.find(room => room.id === chosen.roomId)?.number ?? chosen.roomId} · {chosen.guestName}</span><Button type="button" variant="outline" onClick={() => setEditGuest(true)}>Alterar hóspede</Button></div>}
        {allowStay && (editGuest || !chosen) && (route === "stay" || !!initialStayId) && <Label className="flex-col items-stretch gap-2">Hospedagem<select aria-label="Hospedagem para cobrança" className="mt-1 min-h-11 w-full rounded border bg-background px-2" value={stayId} onChange={event => { const id = event.target.value; setStayId(id); setStayVersion(eligible.find(stay => stay.id === id)?.recordVersion); setEditGuest(!id) }}><option value="">Selecione</option>{eligible.map(stay => <option key={stay.id} value={stay.id}>Quarto {rooms.find(room => room.id === stay.roomId)?.number ?? stay.roomId} · {stay.guestName}</option>)}</select></Label>}
        {route === "counter" ? <PaymentEditor total={total} lines={lines} onChange={setLines} /> : <p className="text-sm">A entrega será lançada no extrato, sem recebimento no balcão. O estoque será baixado uma única vez.</p>}
      </fieldset>
      {needsCash && <div role="status" className="rounded border p-3 text-sm"><p>Caixa fechado — abra para vender ou lançar bebidas na hospedagem. O carrinho será mantido.</p><CashTurnShortcut /></div>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={pending} onClick={onClose}>Cancelar</Button><Button disabled={pending || needsCash || (route === "stay" && (!allowStay || !chosen))} onClick={submit}>{pending ? "Confirmando…" : route === "stay" ? "Lançar na hospedagem" : "Confirmar venda"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
