import type { DataStore } from "./types"
import { stayBalance, type Stay } from "@/lib/stays"
import { businessDay } from "@/lib/utils/business-values"
import { quoteLodging } from "@/lib/lodging-pricing"
import { isCPF } from "@/lib/utils/cpf-cnpj-validator"
import { z } from "zod"

// Browser examples only. Shared operation uses PostgreSQL's serializable transaction.
export async function reconcileDemoStays(store: DataStore) {
  const [reservations,consumptions,guests] = await Promise.all([store.reservations.getAll(),store.consumptions.getAll(),store.guests.getAll()])
  const stays = await store.stays.getAll()
  for (const r of reservations.filter(r => ['checkin','checkout'].includes(r.status))) {
    let s = stays.find(s => s.reservationId === r.id)
    if (!s) {
      s = { id: 'demo-stay-'+r.id, reservationId:r.id, payerId:r.payerId ?? guests.find(g=>g.cpf===r.cpf)?.customerId, guestName:r.guestName, guestCount:r.guestCount, roomId:r.roomId, checkIn:r.checkIn, checkOut:r.checkOut, status:r.status==='checkin'?'active':'closed', lodgingValue:r.totalValue, nightlyPrices:r.nightlyPrices, recordVersion:0, groupId:r.groupId, occupants:[{id:crypto.randomUUID(),name:r.guestName,customerId:guests.find(g=>g.cpf===r.cpf)?.customerId}], allocations:[{id:crypto.randomUUID(),roomId:r.roomId,start:r.checkIn,end:r.checkOut}], charges:[],payments:[] }
      await store.stays.create(s); stays.push(s)
    }
    let changed=false
    const lodgingPaid=s.payments.filter(p=>p.bucket==='lodging').reduce((v,p)=>v+p.value,0)
    if ((r.paidValue??0)>lodgingPaid+.001) { s.payments.push({id:crypto.randomUUID(),value:Math.round(((r.paidValue??0)-lodgingPaid)*100)/100,bucket:'lodging',method:'sinal/recebimento de exemplo',createdAt:new Date().toISOString()}); changed=true }
    if(s.status==='active') for(const item of consumptions.find(c=>c.roomId===r.roomId)?.items??[]) if(!s.charges.some(c=>c.id===item.id)) {
      s.charges.push({...item,status:'active',createdAt:new Date().toISOString()}); changed=true
    }
    if(changed) await store.stays.update(s.id,{payments:s.payments,charges:s.charges,recordVersion:s.recordVersion+1})
  }
}
export async function demoConsumptionCorrection(store: DataStore, roomId: number, itemId?: string) {
  await reconcileDemoStays(store)
  const stay=(await store.stays.getAll()).find(s=>s.roomId===roomId&&s.status==='active')
  if(!stay)return
  if(itemId) {
    const charge=stay.charges.find(c=>c.id===itemId)
    if(charge && stayBalance(stay).consumptionBalance<charge.unitPrice*charge.quantity)throw Error('Consumo possui recebimento; concilie antes')
    await store.stays.update(stay.id,{charges:stay.charges.map(c=>c.id===itemId?{...c,status:'corrected',reason:'Correção de cobrança de exemplo'}:c),recordVersion:stay.recordVersion+1})
  } else {
    const value=stayBalance(stay).consumptionBalance
    if(value>0)await store.stays.update(stay.id,{payments:[...stay.payments,{id:crypto.randomUUID(),value,bucket:'consumption',method:'recebimento de exemplo',createdAt:new Date().toISOString()}],recordVersion:stay.recordVersion+1})
  }
}
const command=z.object({stayId:z.string().min(1),recordVersion:z.number().int().nonnegative()}).passthrough()
export async function demoStayOperation(store: DataStore,kind: string,payload: unknown,can:(p:string)=>boolean,username: string) {
  await reconcileDemoStays(store)
  const input=command.parse(payload)
  const s=await store.stays.getById(input.stayId)
  if(!s)throw Error('Hospedagem não encontrada')
  if(s.recordVersion!==input.recordVersion)throw Error('Hospedagem alterada; reabra o extrato antes de confirmar')
  if(!['stay-receive','receive-account'].includes(kind)&&s.status!=='active')throw Error('Hospedagem encerrada')
  const demand=(p:string)=>{if(!can(p))throw Error('Você não tem permissão para esta ação')}
  const balances=stayBalance(s)
  if(kind==='stay-occupants') {
    demand('hospitality.occupants')
    const people=z.array(z.object({name:z.string().trim().min(1).max(200),customerId:z.string().optional()})).min(1).max(100).parse(input.occupants)
    if(people.length!==s.guestCount)throw Error('Informe todos os ocupantes da hospedagem')
    const customers=await store.customers.getAll()
    for(const person of people)if(person.customerId){const c=customers.find(c=>c.id===person.customerId&&c.active&&isCPF(c.cpfCnpj));if(!c)throw Error('Ocupante deve ser pessoa física ativa');person.name=c.name}
    s.occupants=people.map(o=>({...o,id:crypto.randomUUID()}))
  }else if(kind==='stay-checkout') {
    demand('hospitality.checkout')
    if(balances.balance<0)throw Error('Concilie o saldo antes da saída')
    if(balances.balance>0) {
      demand('hospitality.companyCredit')
      const payer=(await store.customers.getAll()).find(c=>c.id===s.payerId)
      if(!payer?.active||!payer.cpfCnpj||isCPF(payer.cpfCnpj)||!payer.roles?.includes('payer'))throw Error('Saída a prazo exige empresa ativa como pagadora')
      const due=z.string().date().parse(input.dueDate)
      if(input.confirmed!==true||due<businessDay())throw Error('Confirme a cobrança e informe vencimento a partir de hoje')
      await store.accountsReceivable.create({sourceStayId:s.id,customerId:payer.id,customerName:payer.name,description:'Hospedagem '+s.reservationId,value:balances.balance,paidValue:0,issueDate:businessDay(),dueDate:due,status:'pendente'})
    }
    s.status='closed';s.endedAt=new Date().toISOString()
    await store.reservations.update(s.reservationId,{status:'checkout'})
    await store.rooms.update(s.roomId,{status:'limpeza',guest:undefined,guestCpf:undefined,checkIn:undefined,checkOut:undefined})
    await store.consumptions.clearByRoomId(s.roomId)
  }else if(kind==='stay-receive'||kind==='receive-account') {
    demand(kind==='receive-account'?'accountsReceivable.receive':'hospitality.receive');if(s.status==='closed')demand('accountsReceivable.receive')
    const value=z.number().positive().finite().refine(v=>Math.abs(v*100-Math.round(v*100))<.00001).parse(input.value)
    if(value>balances.balance)throw Error('Valor excede o saldo da hospedagem')
    const method=z.enum(['pix','dinheiro','debito','credito','credito_hospede']).parse(input.paymentMethod)
    if(method==='credito_hospede')throw Error('Use o fluxo de crédito pessoal existente para os exemplos')
    const lodging=Math.min(value,Math.max(0,balances.lodgingBalance))
    if(method!=='dinheiro'){
      const accounts=(await store.bankAccounts.getAll()).filter(a=>a.active)
      const account=accounts.find(a=>a.id===input.accountId)||(accounts.length===1?accounts[0]:undefined)
      if(!account)throw Error('Selecione uma conta ativa')
      await store.bankAccounts.update(account.id,{currentBalance:account.currentBalance+value})
    }
    const transaction=await store.transactions.create({date:new Date().toISOString(),description:'Hospedagem '+s.reservationId,refId:'Hospedagem '+s.reservationId,value,type:'receita',paymentMethod:method,responsible:username})
    if(lodging>0)s.payments.push({id:crypto.randomUUID(),value:lodging,bucket:'lodging',method,createdAt:new Date().toISOString(),transactionId:transaction.id})
    if(value>lodging)s.payments.push({id:crypto.randomUUID(),value:Math.round((value-lodging)*100)/100,bucket:'consumption',method,createdAt:new Date().toISOString()})
    const r=await store.reservations.getById(s.reservationId)
    if(r&&lodging)await store.reservations.update(r.id,{paidValue:(r.paidValue??0)+lodging})
    const title=(await store.accountsReceivable.getAll()).find(t=>t.sourceStayId===s.id)
    if(title){const paidValue=Math.round(((title.paidValue??0)+value)*100)/100;await store.accountsReceivable.update(title.id,{paidValue,status:paidValue===title.value?'pago':'pendente'})}
    if(s.status==='active'&&value-lodging>=balances.consumptionBalance)await store.consumptions.clearByRoomId(s.roomId)
  }else if(kind==='stay-transfer') {
    demand('hospitality.transfer')
    const roomId=z.number().int().positive().parse(input.roomId), date=z.string().date().parse(input.effectiveDate)
    const why=z.string().trim().min(5).max(500).parse(input.reason)
    const room=await store.rooms.getById(roomId),old=await store.rooms.getById(s.roomId)
    if(!room||!old||room.id===s.roomId||room.status!=='disponivel'||!s.guestCount||!room.capacity||room.capacity<s.guestCount)throw Error('Destino indisponível ou com capacidade insuficiente')
    if(date!==businessDay()||date<s.checkIn||date>=s.checkOut)throw Error('Troca deve começar hoje, dentro da hospedagem')
    if((await store.reservations.getAll()).some(r=>r.id!==s.reservationId&&r.roomId===room.id&&['confirmada','checkin'].includes(r.status)&&r.checkIn<s.checkOut&&r.checkOut>date))throw Error('Destino possui reserva no período')
    if(input.reprice){const quote=quoteLodging(room,await store.lodgingTariffs.getAll(),{roomId,guestCount:s.guestCount,checkIn:date,checkOut:s.checkOut});if(!s.nightlyPrices?.length)throw Error('Preço legado sem composição');const nights=[...s.nightlyPrices.filter(n=>n.date<date),...quote.nights];const total=nights.reduce((v,n)=>v+Math.round(n.total*100),0)/100;if(total<s.lodgingValue)demand('lodgingTariffs.override');if(total+balances.consumption<balances.paid)throw Error('Preço inferior ao recebido');s.lodgingValue=total;s.nightlyPrices=nights}
    s.allocations=s.allocations.map(a=>a.end>date?{...a,end:date}:a)
    s.allocations.push({id:crypto.randomUUID(),roomId,start:date,end:s.checkOut,reason:why})
    const consumption=await store.consumptions.getByRoomId(s.roomId)
    if(consumption){await store.consumptions.clearByRoomId(s.roomId);await store.consumptions.upsertByRoomId({...consumption,roomId})}
    await store.rooms.update(s.roomId,{status:'limpeza',guest:undefined,guestCpf:undefined,checkIn:undefined,checkOut:undefined})
    await store.rooms.update(roomId,{status:'ocupado',guest:old.guest,guestCpf:old.guestCpf,checkIn:date,checkOut:s.checkOut})
    await store.reservations.update(s.reservationId,{roomId,roomNumber:room.number,checkIn:date,totalValue:s.lodgingValue,nightlyPrices:s.nightlyPrices??undefined})
    s.roomId=roomId
  }else throw Error('Operação de hospedagem inválida')
  await store.stays.update(s.id,{...s,recordVersion:s.recordVersion+1})
  await store.auditLog.create({date:new Date().toISOString(),user:username,action:kind,reference:s.id})
  return {success:true}
}
