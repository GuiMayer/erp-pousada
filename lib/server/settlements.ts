import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { Actor } from './auth'
import { demand } from './permissions'
import { HttpError } from './http'
import { requireVersion } from './concurrency'
import { recordAudit } from './audit'
import { postPayments, type PostedPayment } from './business-finance'
import { receiveStay,stayInclude } from './stays'
import type { PaymentLine } from '@/lib/payments'
type Tx=Prisma.TransactionClient
type Tender={paymentMethod?:string;accountId?:string;payments?:PaymentLine[]}
type ReceivableTarget={accountReceivableId:string;installmentId?:string;value?:number;recordVersion?:number}

function takePayment(pool:PostedPayment[],value:number) {
  let remaining=Math.round(value*100);const taken:PostedPayment[]=[]
  for(const p of pool) {
    const cents=Math.min(remaining,Math.round(p.value*100));if(!cents)continue
    taken.push({...p,value:cents/100});p.value=(Math.round(p.value*100)-cents)/100;remaining-=cents
  }
  if(remaining)throw new HttpError(409,'Recebimento e alocações divergentes')
  return taken
}
async function allocate(tx:Tx,posted:PostedPayment[],targetType:string,targetId:string) {
  for(const p of posted)await tx.paymentAllocation.create({data:{id:randomUUID(),transactionId:p.transactionId,targetType,targetId,value:p.value}})
}
export async function receiveTargets(tx:Tx,actor:Actor,targets:ReceivableTarget[],tender:Tender) {
  demand(actor,'accountsReceivable.receive')
  const keys=targets.map(t=>t.accountReceivableId)
  if(new Set(keys).size!==keys.length)throw new HttpError(400,'Selecione cada título uma única vez')
  const loaded=[]
  for(const t of targets) {
    const account=await tx.accountReceivable.findUniqueOrThrow({where:{id:t.accountReceivableId},include:{installments:true}})
    if(t.recordVersion!==undefined)requireVersion(t.recordVersion,account.recordVersion)
    if(!['pendente','vencido'].includes(account.status))throw new HttpError(409,'Título já recebido ou cancelado')
    const part=t.installmentId?account.installments.find(p=>p.id===t.installmentId):undefined
    if(account.sourceStayId&&t.installmentId)throw new HttpError(400,'Cobrança de hospedagem sem parcela independente')
    if(account.installments.length&&!part)throw new HttpError(409,'Selecione uma parcela pendente')
    if(t.installmentId&&!part)throw new HttpError(404,'Parcela não encontrada')
    if(part&&!['pendente','vencido'].includes(part.status))throw new HttpError(409,'Parcela já recebida')
    const remaining=part?part.value.minus(part.paidValue):account.value.minus(account.paidValue)
    const value=t.value??Number(remaining)
    if(value<=0||new Prisma.Decimal(value).gt(remaining))throw new HttpError(409,'Valor excede o saldo elegível do título/parcela')
    loaded.push({account,part,value})
  }
  const total=loaded.reduce((s,t)=>s+Math.round(t.value*100),0)/100
  const result=await postPayments(tx,actor,`Recebimento ${keys.join(', ')}`,total,tender,'receivable-batch',keys.join(','))
  const pool=result.posted.map(p=>({...p}))
  for(const {account,part,value} of loaded) {
    const applied=takePayment(pool,value)
    if(account.sourceStayId) {
      const stay=await tx.stay.findUniqueOrThrow({where:{id:account.sourceStayId},include:stayInclude})
      await receiveStay(tx,actor,stay,value,undefined,undefined,'general',undefined,applied)
    }else{
      if(part) {const paidValue=part.paidValue.plus(value);await tx.accountReceivableInstallment.update({where:{id:part.id},data:{paidValue,status:paidValue.equals(part.value)?'pago':'pendente',paymentDate:paidValue.equals(part.value)?new Date():null}})}
      const paidValue=account.paidValue.plus(value)
      await tx.accountReceivable.update({where:{id:account.id},data:{paidValue,status:paidValue.equals(account.value)?'pago':'pendente',paymentDate:paidValue.equals(account.value)?new Date():null}})
    }
    await allocate(tx,applied,part?'receivable-installment':'receivable',part?.id??account.id)
    await recordAudit(tx,actor,'Título recebido',account.id,{entityType:'accountsReceivable',entityId:account.id,operation:'update',metadata:{value,installmentId:part?.id,batchId:result.batchId}})
  }
  return {success:true,change:result.change,batchId:result.batchId}
}
export async function payExpense(tx:Tx,actor:Actor,input:{expenseId:string;recordVersion?:number;installmentId?:string;value?:number}&Tender) {
  demand(actor,'expenses.pay')
  const expense=await tx.expense.findUniqueOrThrow({where:{id:input.expenseId},include:{installments:true}})
  if(input.recordVersion!==undefined)requireVersion(input.recordVersion,expense.recordVersion)
  const part=input.installmentId?expense.installments.find(p=>p.id===input.installmentId):undefined
  if(input.installmentId&&!part)throw new HttpError(404,'Parcela não encontrada')
  if(expense.paid||part?.paid||(!part&&expense.installments.length))throw new HttpError(409,'Despesa já paga ou selecione uma parcela pendente')
  const target=part??expense,remaining=target.value.minus(target.paidValue),value=input.value??Number(remaining)
  if(value<=0||new Prisma.Decimal(value).gt(remaining))throw new HttpError(409,'Valor excede o saldo elegível da despesa')
  const result=await postPayments(tx,actor,part?.id??expense.id,value,input,'expense',expense.id,'despesa')
  await allocate(tx,result.posted,part?'expense-installment':'expense',part?.id??expense.id)
  if(part){const paidValue=part.paidValue.plus(value);await tx.expenseInstallment.update({where:{id:part.id},data:{paidValue,paid:paidValue.equals(part.value),paymentDate:paidValue.equals(part.value)?new Date():null}})}
  const paidValue=expense.paidValue.plus(value)
  await tx.expense.update({where:{id:expense.id},data:{paidValue,paid:paidValue.equals(expense.value),paymentDate:paidValue.equals(expense.value)?new Date():null}})
  await recordAudit(tx,actor,'Despesa paga',expense.id,{entityType:'expenses',entityId:expense.id,operation:'update',metadata:{value,installmentId:part?.id,batchId:result.batchId}})
  return {success:true,batchId:result.batchId}
}
