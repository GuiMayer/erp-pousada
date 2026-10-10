"use client"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { stayBalance, type Stay } from "@/lib/stays"
import { businessDay } from "@/lib/utils/business-values"
import { formatCurrency } from "@/lib/utils/formatters"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet"
import { PaymentDialog } from "./payment-fields"
import { previewLodging, LodgingQuotePreview } from "./lodging-quote-preview"

export function StayButton({ stay, label = "Hospedagem / extrato" }: { stay: Stay; label?: string }) {
  const [snapshot,setSnapshot]=useState<Stay|null>(null)
  return <><Button size="sm" variant="outline" onClick={()=>setSnapshot(structuredClone(stay))}>{label}</Button>{snapshot&&<StaySheet stay={snapshot} onClose={()=>setSnapshot(null)}/>}</>
}
export function StaySheet({ stay, onClose }: { stay: Stay; onClose: ()=>void }) {
  const { runOperation, rooms, customers, lodgingTariffs, accountsReceivable } = useApp()
  const { can } = useAuth()
  const [occupants,setOccupants]=useState(()=>Array.from({length:stay.guestCount??stay.occupants.length},(_,i)=>({name:stay.occupants[i]?.name??"",customerId:stay.occupants[i]?.customerId??""})))
  const [destination,setDestination]=useState(""),[reason,setReason]=useState(""),[reprice,setReprice]=useState(false)
  const [dueDate,setDueDate]=useState(""),[confirmed,setConfirmed]=useState(false)
  const [payment,setPayment]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState("")
  const balance=stayBalance(stay), active=stay.status==='active'
  const title=accountsReceivable.find(t=>t.sourceStayId===stay.id)
  const payer=customers.find(c=>c.id===stay.payerId)
  const corporatePayer=!!payer?.active&&payer.cpfCnpj.replace(/[^0-9A-Z]/gi,'').length===14&&!!payer.roles?.includes('payer')
  const allowedReceive=can('hospitality.receive')&&(active||can('accountsReceivable.receive'))
  const target={stayId:stay.id,recordVersion:stay.recordVersion}
  async function perform(kind: string,payload: object) {
    if(pending)return
    setPending(true);setError("")
    try{await runOperation(kind,{...target,...payload});onClose()}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir. Reabra o extrato e tente novamente.')}
    finally{setPending(false)}
  }
  return <Sheet open onOpenChange={open=>{if(!open&&!pending)onClose()}}><SheetContent className="flex flex-col overflow-y-auto sm:max-w-2xl">
    <SheetHeader><SheetTitle>Hospedagem · {stay.guestName}</SheetTitle><SheetDescription>{stay.checkIn} a {stay.checkOut} · {active?'Em andamento':'Encerrada'} · Reserva {stay.reservationId}</SheetDescription></SheetHeader>
    <div className="space-y-6 py-5">
      <section className="space-y-3 rounded-lg border p-4" aria-label="Extrato da hospedagem">
        <p className="text-sm">Pagador: <strong>{payer?.name??stay.payerId??'Cadastro legado sem pagador definido'}</strong></p>
        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt>Diárias</dt><dd>{formatCurrency(stay.lodgingValue)}</dd></div><div><dt>Bebidas e ajustes</dt><dd>{formatCurrency(balance.consumption)}</dd></div><div><dt>Total acordado</dt><dd>{formatCurrency(balance.total)}</dd></div><div><dt>Sinal e recebimentos</dt><dd>{formatCurrency(balance.paid)}</dd></div></dl>
        <p className="font-semibold">Saldo a receber: {formatCurrency(balance.balance)}</p>
        {title&&<p className="text-sm">Cobrança {title.id} · Vencimento {title.dueDate} · {title.status==='pago'?'Quitada':'Em aberto'}</p>}
        {balance.balance>0&&allowedReceive&&<Button onClick={()=>setPayment(true)}>Receber valor parcial ou total</Button>}
      </section>
      <section className="space-y-2"><h3 className="font-semibold">Diárias acordadas</h3>{stay.nightlyPrices?.length?<ul className="space-y-1 text-sm">{stay.nightlyPrices.map(n=><li key={n.date} className="flex flex-wrap justify-between gap-2"><span>{n.date} · {n.guests} pessoa(s) · {n.tariffName}</span><span>{formatCurrency(n.total)}</span></li>)}</ul>:<p className="text-sm text-muted-foreground">Preço legado preservado; composição por noite não registrada.</p>}</section>
      <section className="space-y-2"><h3 className="font-semibold">Consumo preservado</h3>{!stay.charges.length&&<p className="text-sm text-muted-foreground">Nenhum item lançado.</p>}{stay.charges.map(c=><div key={c.id} className="rounded border p-2 text-sm"><p>{c.quantity} × {c.label} · {formatCurrency(c.unitPrice*c.quantity)}{c.status==='corrected'?' · Correção de cobrança':''}</p>{c.reason&&<p className="text-muted-foreground">{c.reason}</p>}</div>)}</section>
      {!!stay.adjustments?.length && <section className="space-y-2"><h3 className="font-semibold">Ajustes das diárias</h3><p className="text-xs text-muted-foreground">Já incluídos no valor líquido das diárias; não são somados novamente.</p>{stay.adjustments.map(a=><p key={a.id} className="text-sm">{a.reason} · {formatCurrency(a.value)}</p>)}</section>}
      <section className="space-y-2"><h3 className="font-semibold">Recebimentos e crédito aplicado</h3>{stay.payments.length?stay.payments.map(p=><p key={p.id} className="text-sm">{p.createdAt.slice(0,10)} · {p.method} · {formatCurrency(p.value)} · {p.bucket==='lodging'?'diárias':'consumo'}</p>):<p className="text-sm text-muted-foreground">Nenhum recebimento.</p>}</section>
      <section className="space-y-3"><h3 className="font-semibold">Ocupantes</h3>{occupants.map((o,i)=><div key={i} className="grid gap-2 rounded border p-3 sm:grid-cols-2"><Label>Nome do ocupante {i+1}<Input value={o.name} disabled={!active||!can('hospitality.occupants')||!!o.customerId} onChange={e=>setOccupants(v=>v.map((p,j)=>i===j?{...p,name:e.target.value}:p))}/></Label><Label>Pessoa cadastrada (opcional)<select aria-label={`Pessoa cadastrada ${i+1}`} className="mt-1 min-h-11 w-full rounded border bg-background px-2" value={o.customerId} disabled={!active||!can('hospitality.occupants')} onChange={e=>setOccupants(v=>v.map((p,j)=>i===j?{name:customers.find(c=>c.id===e.target.value)?.name??p.name,customerId:e.target.value}:p))}><option value="">Informar apenas nome</option>{customers.filter(c=>c.active&&c.cpfCnpj.replace(/\D/g,'').length===11).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Label></div>)}{active&&can('hospitality.occupants')&&stay.guestCount&&<Button variant="outline" disabled={pending||occupants.some(o=>!o.name.trim())} onClick={()=>perform('stay-occupants',{occupants:occupants.map(o=>({...o,customerId:o.customerId||undefined}))})}>Salvar ocupantes</Button>}{!stay.guestCount&&<p className="text-sm text-muted-foreground">Quantidade legada desconhecida. Não foi inventada uma ocupação.</p>}</section>
      <section className="space-y-2"><h3 className="font-semibold">Histórico de quartos</h3>{stay.allocations.map(a=><p key={a.id} className="text-sm">Quarto {rooms.find(r=>r.id===a.roomId)?.number??a.roomId} · {a.start} a {a.end}{a.reason?` · ${a.reason}`:''}</p>)}</section>
      {active&&can('hospitality.transfer')&&<details className="rounded-lg border p-4"><summary className="min-h-11 cursor-pointer font-semibold">Trocar de quarto</summary><div className="mt-3 space-y-3"><Label>Destino<select aria-label="Quarto de destino" className="mt-1 min-h-11 w-full rounded border bg-background px-2" value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Selecione</option>{rooms.filter(r=>r.id!==stay.roomId&&r.status==='disponivel').map(r=><option key={r.id} value={r.id}>{r.number} · Capacidade {r.capacity??'não configurada'}</option>)}</select></Label><Label>Motivo<Input value={reason} onChange={e=>setReason(e.target.value)}/></Label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={reprice} onChange={e=>setReprice(e.target.checked)}/>Recalcular somente as diárias a partir de hoje</label><p className="text-xs text-muted-foreground">Sem essa opção, o valor acordado é preservado. A troca mantém a mesma conta; o quarto anterior vai para limpeza.</p>{reprice&&destination&&<LodgingQuotePreview result={previewLodging(rooms.find(r=>r.id===Number(destination)),lodgingTariffs,stay.guestCount??0,businessDay(),stay.checkOut)}/>}<Button disabled={pending||!destination||reason.trim().length<5} onClick={()=>perform('stay-transfer',{roomId:Number(destination),effectiveDate:businessDay(),reason,reprice})}>Confirmar troca de quarto</Button></div></details>}
      {active&&can('hospitality.checkout')&&<section className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Encerrar hospedagem</h3>{balance.balance>0?<>{corporatePayer&&can('hospitality.companyCredit')?<><p className="text-sm">Saída a prazo exige empresa ativa como pagadora. Será criada uma cobrança pelo saldo, sem registrar recebimento.</p><Label>Vencimento<Input type="date" min={businessDay()} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></Label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo a saída e a cobrança da empresa</label><Button disabled={pending||!confirmed||!dueDate} onClick={()=>perform('stay-checkout',{dueDate,confirmed})}>Encerrar com cobrança empresarial</Button></>:<p className="text-sm">Quite o saldo antes da saída. Saída empresarial a prazo exige autorização do supervisor.</p>}</>:<Button disabled={pending} onClick={()=>perform('stay-checkout',{})}>Confirmar check-out quitado</Button>}</section>}
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button variant="outline" disabled={pending} onClick={onClose}>Fechar extrato</Button>
    </div>
    <PaymentDialog open={payment} onClose={()=>setPayment(false)} title="Receber hospedagem" maximum={balance.balance} allowCredit={active&&stay.payerId===stay.occupants[0]?.customerId} onConfirm={async(paymentMethod,accountId,value)=>{await runOperation('stay-receive',{...target,paymentMethod,accountId,value});onClose()}}/>
  </SheetContent></Sheet>
}
export function StaysList() {
  const {stays=[],customers=[]}=useApp(),{can}=useAuth()
  const [query,setQuery]=useState(''),[status,setStatus]=useState('active')
  if(!can('stays.read'))return null
  const filtered=stays.filter(s=>(status==='all'||s.status===status)&&`${s.guestName} ${s.reservationId} ${customers.find(c=>c.id===s.payerId)?.name??''}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="space-y-3 rounded-lg border p-4"><h2 className="font-semibold">Hospedagens e cobranças</h2><p className="text-sm text-muted-foreground">Acompanhe a estadia, seus ocupantes e a conta, inclusive após a saída.</p><div className="flex flex-wrap gap-2"><Input className="flex-1" aria-label="Buscar hospedagem" placeholder="Hóspede, empresa ou reserva" value={query} onChange={e=>setQuery(e.target.value)}/><select className="min-h-11 rounded border bg-background px-2" aria-label="Situação da hospedagem" value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Em andamento</option><option value="closed">Encerradas</option><option value="all">Todas</option></select></div><div className="grid gap-3 md:grid-cols-2">{filtered.map(s=><div key={s.id} className="space-y-2 rounded border p-3"><p className="font-medium">{s.guestName}</p><p className="text-sm">{customers.find(c=>c.id===s.payerId)?.name??'Pagador legado'} · {s.status==='active'?'Em andamento':'Encerrada'}</p><p className="text-sm">Saldo: {formatCurrency(stayBalance(s).balance)}</p><StayButton stay={s}/></div>)}</div>{!filtered.length&&<p className="text-sm text-muted-foreground">Nenhuma hospedagem neste filtro.</p>}</section>
}
