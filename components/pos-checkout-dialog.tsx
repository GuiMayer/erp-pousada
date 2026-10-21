"use client"
import { useState } from 'react'
import { useApp } from '@/lib/app-context'
import { useAuth } from '@/lib/auth-context'
import {distributePayment,type PaymentLine} from '@/lib/payments'
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { PaymentEditor } from './payment-editor'
import {formatCurrency} from '@/lib/utils/formatters'
import { CashTurnShortcut } from './cash-turn-shortcut'
export type CheckoutSelection={payments?:PaymentLine[];stayId?:string;stayVersion?:number}
export function POSCheckoutDialog({total,onClose,onConfirm}:{total:number;onClose:()=>void;onConfirm:(selection:CheckoutSelection)=>Promise<void>}) {
  const {stays=[],rooms=[],cashCloses=[]}=useApp(),{can}=useAuth()
  const [route,setRoute]=useState('counter'),[stayId,setStayId]=useState(''),[stayVersion,setStayVersion]=useState<number>()
  const [lines,setLines]=useState<PaymentLine[]>([{method:'dinheiro',value:total}])
  const [pending,setPending]=useState(false),[error,setError]=useState('')
  const eligible=stays.filter(s=>s.status==='active'),chosen=eligible.find(s=>s.id===stayId)
  const needsCash=route==='counter'&&lines.some(line=>line.method==='dinheiro'&&line.value>0)&&!cashCloses.some(turn=>turn.status==='aberto')
  async function submit(){if(pending||needsCash)return;setError('');try{if(route==='counter')distributePayment(total,lines);else if(!chosen)throw Error('Selecione a hospedagem ativa');setPending(true);await onConfirm(route==='counter'?{payments:lines}:{stayId:chosen!.id,stayVersion})}catch(e){setError((e as Error).message)}finally{setPending(false)}}
  return <Dialog open onOpenChange={open=>{if(!open&&!pending)onClose()}}><DialogContent mobileTask protectDraft busy={pending} className="sm:max-w-lg"><DialogHeader><DialogTitle>Confirmar entrega e cobrança</DialogTitle><DialogDescription>Total: {formatCurrency(total)}. O estoque será baixado uma única vez.</DialogDescription></DialogHeader><fieldset disabled={pending} className="space-y-4"><Label>Como cobrar<select aria-label="Como cobrar" value={route} onChange={e=>setRoute(e.target.value)} className="mt-1 min-h-11 w-full rounded border bg-background px-2"><option value="counter">Receber no balcão</option>{can('consumptions.create')&&can('stays.read')&&<option value="stay">Lançar na hospedagem</option>}</select></Label>{route==='counter'?<PaymentEditor total={total} lines={lines} onChange={setLines}/>:<><Label>Hospedagem<select aria-label="Hospedagem para cobrança" className="mt-1 min-h-11 w-full rounded border bg-background px-2" value={stayId} onChange={e=>{setStayId(e.target.value);setStayVersion(eligible.find(s=>s.id===e.target.value)?.recordVersion)}}><option value="">Selecione</option>{eligible.map(s=><option key={s.id} value={s.id}>Quarto {rooms.find(r=>r.id===s.roomId)?.number??s.roomId} · {s.guestName}</option>)}</select></Label><p className="text-sm">Esta entrega entra no extrato. Não haverá recebimento no PDV nem segunda baixa ao pagar a hospedagem.</p></>}</fieldset>{needsCash&&<div role="status" className="rounded border p-3 text-sm"><p>Abra o caixa para receber em dinheiro. O carrinho será mantido.</p><CashTurnShortcut /></div>}{error&&<p role="alert" className="text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={pending} onClick={onClose}>Cancelar</Button><Button disabled={pending||needsCash} onClick={submit}>{pending?'Confirmando…':route==='stay'?'Lançar na hospedagem':'Confirmar venda'}</Button></DialogFooter></DialogContent></Dialog>
}
