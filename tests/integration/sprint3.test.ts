import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { executeOperation } from "@/lib/server/operations"
import { ALL_PERMISSIONS, PROFILES } from "@/lib/permissions"
import { createCollectionItem, updateCollectionItem, deleteCollectionItem, exportAllCollections, importAllCollections, getCollection } from "@/lib/server/db/relational-data-service"
import { businessDay } from "@/lib/utils/business-values"
import type { Actor } from "@/lib/server/auth"
import { stayBalance, type Stay } from "@/lib/stays"

if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw new Error("S2 exige erp_test isolado")
const prefix = 's3-'+randomUUID(), day = businessDay()
const next = (offset: number) => new Date(Date.parse(day)+offset*86400000).toISOString().slice(0,10)
let actor: Actor, reception: Actor
beforeAll(async () => {
  for (const profile of ['administrador','recepcao']) {
    const user = await prisma.user.create({ data: { id: prefix+profile, username: prefix+profile, fullName: 'Teste S2', password: 'test-only', role: profile === 'administrador' ? 'supervisor' : 'operador', accessProfile: profile, createdBy: 'test' } })
    const session = await prisma.authSession.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now()+600000) } })
    const a: Actor = { id: user.id, username: user.username, role: profile === 'administrador' ? 'supervisor' : 'operador', sessionId: session.id, permissions: profile === 'administrador' ? ALL_PERMISSIONS : PROFILES.recepcao.permissions, approvedUntil: null }
    if (profile === 'administrador') actor=a; else reception=a
  }
})
beforeEach(async () => {
  for (const a of [actor,reception]) await prisma.authSession.upsert({ where:{id:a.sessionId},create:{id:a.sessionId,userId:a.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+600000)},update:{expiresAt:new Date(Date.now()+600000)} })
  await prisma.$executeRawUnsafe('TRUNCATE customers, rooms, guest_profiles, product_categories, transactions, bank_accounts, cash_closes CASCADE')
  await prisma.bankAccount.deleteMany()
  await prisma.room.createMany({ data: [1,2,3].map(id => ({ id, number: 'S2-'+id, type: 'casal', status: 'disponivel', capacity: id === 3 ? 1 : 2 })) })
  await createCollectionItem('customers',{ id: 's2-company', name:'Empresa S2', cpfCnpj:'11222333000181', active:true, roles:['payer'] },actor)
  await createCollectionItem('customers',{ id: 's2-person', name:'Pessoa S2', cpfCnpj:'52998224725', active:true, roles:['guest','payer'] },actor)
  await prisma.lodgingTariff.create({ data:{id:'s2-tariff',name:'Duas pessoas',roomType:'casal',minGuests:1,maxGuests:2,pricePerPerson:100,validFrom:new Date(next(-30))} })
  await prisma.productCategory.create({data:{id:'s2-beverages',name:'Bebidas',icon:'Cup',color:'blue'}})
  await prisma.pOSProduct.create({data:{id:'s2-drink',name:'Água S2',price:12,categoryId:'s2-beverages',trackStock:true}})
  await prisma.stockItem.create({data:{id:'s2-stock',productId:'s2-drink',productName:'Água S2',unit:'un',currentStock:10,minimumStock:1,maximumStock:20,averageCost:3,lastPurchasePrice:3}})
  await prisma.bankAccount.create({data:{id:'s2-bank',name:'Conta S2',type:'corrente',active:true,initialBalance:0,currentBalance:0}})
})
afterAll(async () => { await prisma.user.deleteMany({where:{id:{startsWith:prefix}}}); await prisma.$disconnect() })
const op = (kind: string, payload: unknown, a=actor, requestId=randomUUID()) => executeOperation(a,requestId,kind,payload)
async function start(company=true, deposit=0) {
  const payload={roomId:1,cpf:'52998224725',guestName:'Pessoa S2',guestCount:2,payerId:company?'s2-company':'s2-person',checkIn:day,checkOut:next(2),totalValue:400}
  const r = await op('reserve',payload) as {id:string}
  if(deposit) await op('pay-reservation',{reservationId:r.id,value:deposit,paymentMethod:'pix',accountId:'s2-bank'})
  await op('check-in',payload)
  await op('add-consumption',{roomId:1,item:{id:randomUUID(),productId:'s2-drink',label:'nome adulterado',unitPrice:1,quantity:2}})
  return current()
}
async function current() { return (await getCollection('stays'))[0] as Stay }

const sale=(saleId=randomUUID(),extra:object={})=>({sale:{id:saleId,items:[{id:randomUUID(),product:{id:'s2-drink'},quantity:10,discount:0}],total:120,amountPaid:120,paymentMethod:'pix',accountId:'s2-bank',...extra},globalDiscount:0})
describe('Sprint 3 — caixa e liquidação',()=>{
  it('entrega cortesia com desconto autorizado sem inventar entrada de dinheiro',async()=>{
    const id=randomUUID(),payload=sale(id,{items:[{id:randomUUID(),product:{id:'s2-drink'},quantity:1,discount:100}],total:0,amountPaid:0,payments:[{method:'dinheiro',value:0}]})
    await op('sale',payload)
    expect(await prisma.transaction.count()).toBe(0)
    expect(Number((await prisma.stockItem.findUniqueOrThrow({where:{id:'s2-stock'}})).currentStock)).toBe(9)
    await op('cancel-sale',{saleId:id,reason:'Cortesia não entregue',returnToStock:true})
    expect(await prisma.transaction.count()).toBe(0)
    expect(Number((await prisma.stockItem.findUniqueOrThrow({where:{id:'s2-stock'}})).currentStock)).toBe(10)
  })
  it('um recebimento misto quita diárias e bebidas com um lançamento por meio e restaura o estorno vinculado',async()=>{
    const s=await start();await op('cash-open',{openingValue:0})
    await op('stay-receive',{stayId:s.id,recordVersion:s.recordVersion,value:424,payments:[{method:'pix',value:410,accountId:'s2-bank'},{method:'dinheiro',value:20}]})
    expect(stayBalance(await current()).balance).toBe(0)
    expect(await prisma.transaction.count({where:{type:'receita'}})).toBe(2)
    expect(await prisma.stayPayment.count()).toBe(3)
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({where:{id:'s2-bank'}})).currentBalance)).toBe(410)
    const id=randomUUID()
    await op('sale',sale(id,{items:[{id:randomUUID(),product:{id:'s2-drink'},quantity:1,discount:0}],total:12,amountPaid:12}))
    await op('cancel-sale',{saleId:id,reason:'Devolução conferida',returnToStock:true})
    await expect(op('cancel-sale',{saleId:id,reason:'Devolução repetida',returnToStock:true})).rejects.toMatchObject({status:409})
    const snapshot=await exportAllCollections();await importAllCollections(snapshot,actor)
    expect(await prisma.transaction.count({where:{reversalOfId:{not:null}}})).toBe(1)
    expect(stayBalance(await current()).balance).toBe(0)
  })
  it('dois recebimentos de um título com a mesma versão aplicam apenas uma alteração',async()=>{
    await createCollectionItem('accountsReceivable',{id:'concurrent',customerId:'s2-company',customerName:'Empresa S2',description:'Cobrança concorrente',value:600,issueDate:day,dueDate:next(5),status:'pendente'},actor)
    const title=await prisma.accountReceivable.findUniqueOrThrow({where:{id:'concurrent'}})
    const payload={targets:[{accountReceivableId:title.id,recordVersion:title.recordVersion,value:250}],paymentMethod:'pix',accountId:'s2-bank'}
    const result=await Promise.allSettled([op('receive-batch',payload),op('receive-batch',payload)])
    expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    expect(Number((await prisma.accountReceivable.findUniqueOrThrow({where:{id:title.id}})).paidValue)).toBe(250)
    expect(await prisma.transaction.count({where:{type:'receita'}})).toBe(1)
  })
  it('AP-15/23/27: misto gera entradas líquidas, estorno segue meios originais e não devolve estoque por padrão',async()=>{
    await op('cash-open',{openingValue:30});const key=randomUUID(),input=sale(key,{amountPaid:130,payments:[{method:'pix',value:40,accountId:'s2-bank'},{method:'dinheiro',value:90}]})
    await op('sale',input,actor,key);await op('sale',input,actor,key)
    const entries=await prisma.transaction.findMany({where:{originId:key}})
    expect(entries.map(e=>Number(e.value)).sort((a,b)=>a-b)).toEqual([40,80]);expect(Number((await prisma.pOSSale.findUniqueOrThrow({where:{id:key}})).change)).toBe(10)
    await op('cancel-sale',{saleId:key,reason:'Bebida consumida, acerto comercial',returnToStock:false})
    expect(await prisma.transaction.count({where:{reversalOfId:{in:entries.map(e=>e.id)}}})).toBe(2)
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({where:{id:'s2-bank'}})).currentBalance)).toBe(0)
    expect(Number((await prisma.stockItem.findUniqueOrThrow({where:{id:'s2-stock'}})).currentStock)).toBe(0)
    const session=await prisma.cashClose.findFirstOrThrow({where:{status:'aberto'}})
    await op('cash-close',{sessionId:session.id,physicalValue:30});expect(Number((await prisma.cashClose.findUniqueOrThrow({where:{id:session.id}})).divergence)).toBe(0)
  })
  it('AP-14: PDV na hospedagem baixa estoque uma vez e recebe somente no extrato',async()=>{
    const s=await start(),key=randomUUID(),input=sale(key,{items:[{id:randomUUID(),product:{id:'s2-drink'},quantity:3,discount:0}],total:35.65,amountPaid:0,payments:undefined,stayId:s.id,stayVersion:s.recordVersion})
    input.globalDiscount=.9722222222222222
    await op('sale',input,actor,key);await op('sale',input,actor,key)
    const updated=await current();expect(stayBalance(updated).consumption).toBe(59.65)
    expect(Number((await prisma.stockItem.findUniqueOrThrow({where:{id:'s2-stock'}})).currentStock)).toBe(5)
    expect(await prisma.transaction.count({where:{refId:`Venda ${key}`}})).toBe(0)
    const charge=updated.charges.find(c=>c.sourceSaleId===key)!
    await expect(op('remove-consumption',{roomId:1,itemId:charge.id})).rejects.toThrow('PDV')
    await op('cancel-sale',{saleId:key,reason:'Devolução utilizável conferida',returnToStock:true})
    expect(stayBalance(await current()).consumption).toBe(24);expect(Number((await prisma.stockItem.findUniqueOrThrow({where:{id:'s2-stock'}})).currentStock)).toBe(8)
  })
  it('AP-24: aloca um recebimento parcial em dois títulos, conserva soma e bloqueia excesso/edição',async()=>{
    for(const id of ['title-a','title-b'])await createCollectionItem('accountsReceivable',{id,customerId:'s2-company',customerName:'Empresa S2',description:id,value:600,issueDate:day,dueDate:next(5),status:'pendente'},actor)
    const titles=await prisma.accountReceivable.findMany(),targets=titles.map(t=>({accountReceivableId:t.id,recordVersion:t.recordVersion,value:250}))
    await op('receive-batch',{targets,payments:[{method:'pix',value:500,accountId:'s2-bank'}]})
    expect((await prisma.accountReceivable.findMany()).map(t=>Number(t.value.minus(t.paidValue)))).toEqual([350,350])
    expect(Number((await prisma.paymentAllocation.aggregate({_sum:{value:true}}))._sum.value)).toBe(500)
    const a=await prisma.accountReceivable.findUniqueOrThrow({where:{id:'title-a'}})
    await expect(op('receive-account',{accountReceivableId:a.id,value:351,paymentMethod:'pix',accountId:'s2-bank'})).rejects.toThrow('saldo')
    await expect(updateCollectionItem('accountsReceivable',a.id,{recordVersion:a.recordVersion,value:700},actor)).rejects.toThrow('parcial')
  })
  it('paga despesa parcelada parcialmente e concilia cada aplicação ao lançamento',async()=>{
    await prisma.bankAccount.update({where:{id:'s2-bank'},data:{currentBalance:500}})
    await createCollectionItem('expenses',{id:'expense',description:'Material',category:'Compras',value:200,dueDate:day,paid:false,installments:[{id:'part',installmentNumber:1,value:200,dueDate:day,paid:false}]},actor)
    await op('pay-expense',{expenseId:'expense',installmentId:'part',value:50,paymentMethod:'pix',accountId:'s2-bank'})
    expect(await prisma.expense.findUnique({where:{id:'expense'}})).toMatchObject({paid:false})
    expect(Number((await prisma.expenseInstallment.findUniqueOrThrow({where:{id:'part'}})).paidValue)).toBe(50)
    await op('pay-expense',{expenseId:'expense',installmentId:'part',value:150,paymentMethod:'pix',accountId:'s2-bank'})
    expect((await prisma.expense.findUniqueOrThrow({where:{id:'expense'}})).paid).toBe(true)
    expect(Number((await prisma.paymentAllocation.aggregate({_sum:{value:true}}))._sum.value)).toBe(200)
  })
  it('AP-26/28: suprimento e sangria conservam total, conferência não altera saldo e usuário sem poder é recusado',async()=>{
    await prisma.bankAccount.update({where:{id:'s2-bank'},data:{currentBalance:500}});await op('cash-open',{openingValue:30})
    await op('cash-movement',{direction:'supply',value:100,accountId:'s2-bank',reason:'Suprimento do turno'})
    await op('cash-movement',{direction:'withdraw',value:40,accountId:'s2-bank',reason:'Depósito da sangria'})
    await expect(op('cash-movement',{direction:'withdraw',value:1000,accountId:'s2-bank',reason:'Teste insuficiente'})).rejects.toThrow('Saldo')
    await expect(op('cash-movement',{direction:'supply',value:1,accountId:'s2-bank',reason:'Teste de acesso'},reception)).rejects.toMatchObject({status:403})
    const movement=await prisma.transaction.findFirstOrThrow({where:{accountId:'s2-bank'}})
    await op('check-transaction',{transactionId:movement.id,checked:true,note:'Conferido no extrato bancário'})
    expect((await prisma.transaction.findUniqueOrThrow({where:{id:movement.id}})).checkedAt).not.toBeNull()
    const cash=await prisma.cashClose.findFirstOrThrow({where:{status:'aberto'}})
    await op('cash-close',{sessionId:cash.id,physicalValue:90})
    expect(Number((await prisma.cashClose.findUniqueOrThrow({where:{id:cash.id}})).expectedValue)).toBe(90)
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({where:{id:'s2-bank'}})).currentBalance)).toBe(440)
  })
  it('preserva vínculos de pagamentos mistos na restauração da hospedagem',async()=>{
    const s=await start(),key=randomUUID()
    await op('sale',sale(key,{items:[{id:randomUUID(),product:{id:'s2-drink'},quantity:1,discount:0}],total:12,amountPaid:0,stayId:s.id,stayVersion:s.recordVersion}))
    const snapshot=await exportAllCollections();await importAllCollections(snapshot,actor)
    expect((await current()).charges.find(c=>c.sourceSaleId===key)?.lineTotal).toBe(12)
    expect((await prisma.pOSSale.findUniqueOrThrow({where:{id:key}})).stayId).toBe(s.id)
  })
})
