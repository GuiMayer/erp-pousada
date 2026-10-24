"use client"
import { BankAccountPicker } from "./payment-fields"
import { distributePayment,type PaymentLine } from '@/lib/payments'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { formatCurrency } from '@/lib/utils/formatters'
export function PaymentEditor({total,lines,onChange,outgoing=false}:{outgoing?:boolean;total:number;lines:PaymentLine[];onChange:(lines:PaymentLine[])=>void}) {
  const update=(index:number,patch:Partial<PaymentLine>)=>onChange(lines.map((p,i)=>i===index?{...p,...patch}:p))
  let message='Distribua o valor entre os meios de pagamento.'
  try {const plan=distributePayment(total,lines);message=`Aplicado: ${formatCurrency(total)} · Troco em dinheiro: ${formatCurrency(plan.change)}`}catch(e){message=(e as Error).message}
  return <div className="space-y-3"><p className="text-sm">{outgoing ? "A despesa sai da conta escolhida. Dinheiro sai da gaveta do turno aberto." : "PIX entra na conta escolhida. Cartões ficam em Cartões a receber. Dinheiro entra no turno aberto. Troco somente em dinheiro."}</p>{lines.map((p,i)=><fieldset key={i} className="grid gap-3 rounded border p-3"><legend className="px-1 text-sm">Pagamento {i+1}</legend><div className="grid grid-cols-2 gap-3"><Label className="flex-col items-stretch gap-2">Meio<select aria-label={`Meio do pagamento ${i+1}`} className="mt-1 min-h-11 w-full rounded border bg-background px-2" value={p.method} onChange={e=>update(i,{method:e.target.value,accountId:undefined})}><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="debito">Débito</option><option value="credito">Crédito</option></select></Label><Label className="flex-col items-stretch gap-2">Valor entregue<Input aria-label={`Valor do pagamento ${i+1}`} type="number" min="0.01" step="0.01" value={p.value||''} onChange={e=>update(i,{value:Number(e.target.value)})}/></Label></div><BankAccountPicker outgoing={outgoing} method={p.method} accountId={p.accountId??''} setAccountId={value=>update(i,{accountId:value||undefined})}/>
{lines.length>1&&<Button variant="outline" type="button" onClick={()=>onChange(lines.filter((_,index)=>index!==i))}>Remover pagamento {i+1}</Button>}</fieldset>)}<p role="status" className="text-sm font-medium">{message}</p><Button variant="outline" type="button" disabled={lines.length>=8} onClick={()=>onChange([...lines,{method:'pix',value:0}])}>Adicionar forma de pagamento</Button>{!outgoing&&<p className="text-xs text-muted-foreground">Registre o repasse no Financeiro quando o cartão for depositado no banco.</p>}</div>
}
