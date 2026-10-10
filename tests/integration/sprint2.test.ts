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
const prefix = 's2-'+randomUUID(), day = businessDay()
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
  await prisma.$executeRawUnsafe('TRUNCATE customers, rooms, guest_profiles, product_categories, transactions CASCADE')
  await prisma.bankAccount.deleteMany()
  await prisma.room.createMany({ data: [1,2,3].map(id => ({ id, number: 'S2-'+id, type: 'casal', status: 'disponivel', capacity: id === 3 ? 1 : 2 })) })
  await createCollectionItem('customers',{ id: 's2-company', name:'Empresa S2', cpfCnpj:'11222333000181', active:true, roles:['payer'] },actor)
  await createCollectionItem('customers',{ id: 's2-person', name:'Pessoa S2', cpfCnpj:'52998224725', active:true, roles:['guest','payer'] },actor)
  await prisma.lodgingTariff.create({ data:{id:'s2-tariff',name:'Duas pessoas',roomType:'casal',minGuests:1,maxGuests:2,pricePerPerson:100,validFrom:new Date(next(-30))} })
  await prisma.productCategory.create({data:{id:'s2-beverages',name:'Bebidas',icon:'Cup',color:'blue'}})
  await prisma.pOSProduct.create({data:{id:'s2-drink',name:'Água S2',price:12,categoryId:'s2-beverages',trackStock:true}})
  await prisma.stockItem.create({data:{id:'s2-stock',productId:'s2-drink',productName:'Água S2',unit:'un',currentStock:10,minimumStock:1,maximumStock:20,averageCost:3,lastPurchasePrice:3}})
  await prisma.stockLot.create({data:{id:'s2-lot',productId:'s2-drink',code:'TEST',origin:'test',quantity:10,receivedQuantity:10,remainingValue:30,unitCost:3}})
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
describe('Sprint 2 — hospedagem independente e cobrança',()=>{
  it('AP-04/07/12: saldo 324 vira título e recebimento 100 conserva saldo 224, sem duplicação',async()=>{
    let s=await start(true,100)
    expect(stayBalance(s)).toMatchObject({total:424,paid:100,balance:324})
    expect(s.charges[0]).toMatchObject({productId:'s2-drink',unitPrice:12,label:'Água S2'})
    const request=randomUUID(), payload={stayId:s.id,recordVersion:s.recordVersion,dueDate:next(10),confirmed:true}
    await op('stay-checkout',payload,actor,request); await op('stay-checkout',payload,actor,request)
    expect(await prisma.accountReceivable.count({where:{sourceStayId:s.id}})).toBe(1)
    expect((await prisma.room.findUniqueOrThrow({where:{id:1}})).status).toBe('limpeza')
    s=await current(); const payRequest=randomUUID(),pay={stayId:s.id,recordVersion:s.recordVersion,value:100,paymentMethod:'pix',accountId:'s2-bank'}
    await op('stay-receive',pay,actor,payRequest); await op('stay-receive',pay,actor,payRequest)
    const title=await prisma.accountReceivable.findUniqueOrThrow({where:{sourceStayId:s.id}})
    expect(Number(title.value.minus(title.paidValue))).toBe(224)
    expect(stayBalance(await current()).balance).toBe(224)
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({where:{id:'s2-bank'}})).currentBalance)).toBe(200)
    expect(Number((await prisma.stockItem.findUniqueOrThrow({where:{id:'s2-stock'}})).currentStock)).toBe(8)
  })
  it('nova ocupação do mesmo quarto não herda conta encerrada',async()=>{
    const s=await start(true,100); await op('stay-checkout',{stayId:s.id,recordVersion:s.recordVersion,dueDate:next(5),confirmed:true})
    await op('release-room',{roomId:1})
    await op('check-in',{roomId:1,cpf:'52998224725',guestName:'Pessoa S2',guestCount:1,checkIn:day,checkOut:next(1),totalValue:100})
    const active=(await getCollection('stays') as Stay[]).find(s=>s.status==='active')!
    expect(active.id).not.toBe(s.id); expect(active.charges).toHaveLength(0); expect(stayBalance(active).balance).toBe(100)
    await op('add-consumption',{roomId:1,item:{id:randomUUID(),productId:'s2-drink',label:'Água',unitPrice:12,quantity:1}})
    const old=(await getCollection('stays') as Stay[]).find(row=>row.id===s.id)!
    await op('stay-receive',{stayId:old.id,recordVersion:old.recordVersion,value:324,paymentMethod:'pix',accountId:'s2-bank'})
    expect((await prisma.roomConsumption.findUniqueOrThrow({where:{roomId:1},include:{items:true}})).items).toHaveLength(1)
  })
  it('saída comum exige quitação e prazo exige empresa, permissão e confirmação',async()=>{
    let s=await start(false)
    await expect(op('check-out',{roomId:1})).rejects.toThrow('Quite')
    await expect(op('stay-checkout',{stayId:s.id,recordVersion:s.recordVersion,dueDate:next(5),confirmed:true})).rejects.toThrow('empresa')
    await prisma.stay.update({where:{id:s.id},data:{payerId:'s2-company'}}); s=await current()
    await expect(op('stay-checkout',{stayId:s.id,recordVersion:s.recordVersion,dueDate:next(5),confirmed:true},reception)).rejects.toMatchObject({status:403})
    await expect(op('stay-checkout',{stayId:s.id,recordVersion:s.recordVersion,dueDate:next(5)})).rejects.toThrow('Confirme')
    expect(await prisma.accountReceivable.count()).toBe(0)
  })
  it('recebe parcialmente pelo título, recusa excesso e duas edições concorrentes',async()=>{
    let s=await start(); await op('stay-checkout',{stayId:s.id,recordVersion:s.recordVersion,dueDate:next(5),confirmed:true})
    let title=await prisma.accountReceivable.findUniqueOrThrow({where:{sourceStayId:s.id}})
    await op('receive-account',{accountReceivableId:title.id,recordVersion:title.recordVersion,value:100,paymentMethod:'pix',accountId:'s2-bank'})
    s=await current()
    await expect(op('stay-receive',{stayId:s.id,recordVersion:s.recordVersion,value:325,paymentMethod:'pix'})).rejects.toThrow('saldo')
    const attempts=await Promise.allSettled([1,2].map(()=>op('stay-receive',{stayId:s.id,recordVersion:s.recordVersion,value:100,paymentMethod:'pix'})))
    expect(attempts.filter(a=>a.status==='fulfilled')).toHaveLength(1)
    title=await prisma.accountReceivable.findUniqueOrThrow({where:{id:title.id}})
    await expect(updateCollectionItem('accountsReceivable',title.id,{recordVersion:title.recordVersion,value:1},actor)).rejects.toThrow('hospedagem')
    await expect(deleteCollectionItem('accountsReceivable',title.id,prisma,actor,title.recordVersion)).rejects.toThrow('hospedagem')
  })
  it('troca preserva identidade, preço e consumo, registra origem e bloqueia destino pequeno',async()=>{
    let s=await start()
    await expect(op('stay-transfer',{stayId:s.id,recordVersion:s.recordVersion,roomId:3,effectiveDate:day,reason:'Solicitação do hóspede'})).rejects.toThrow('capacidade')
    await op('stay-transfer',{stayId:s.id,recordVersion:s.recordVersion,roomId:2,effectiveDate:day,reason:'Solicitação do hóspede'})
    const moved=await current(); expect(moved.id).toBe(s.id); expect(moved.roomId).toBe(2); expect(moved.allocations).toHaveLength(2)
    expect(stayBalance(moved).total).toBe(424); expect(moved.charges).toHaveLength(1)
    expect((await prisma.room.findUniqueOrThrow({where:{id:1}})).status).toBe('limpeza')
    expect(await prisma.roomConsumption.findUnique({where:{roomId:2}})).not.toBeNull()
  })
  it('ocupantes individuais não exigem documento; pessoa cadastrada usa identidade e nome oficiais',async()=>{
    let s=await start()
    await op('stay-occupants',{stayId:s.id,recordVersion:s.recordVersion,occupants:[{customerId:'s2-person',name:'adulterado'},{name:'Acompanhante'}]})
    s=await current(); expect(s.occupants.map(o=>o.name)).toEqual(expect.arrayContaining(['Pessoa S2','Acompanhante']))
    await expect(op('stay-occupants',{stayId:s.id,recordVersion:s.recordVersion,occupants:[{customerId:'s2-company',name:'Empresa'},{name:'Outro'}]})).rejects.toThrow('pessoa física')
  })
  it('pagamento não apaga extrato e crédito pessoal não quita dívida empresarial',async()=>{
    let s=await start()
    await prisma.guestProfile.update({where:{cpf:'52998224725'},data:{creditValue:500}})
    await expect(op('stay-receive',{stayId:s.id,recordVersion:s.recordVersion,value:100,paymentMethod:'credito_hospede'})).rejects.toThrow('Crédito pessoal')
    await op('pay-consumption',{roomId:1,paymentMethod:'pix',accountId:'s2-bank'})
    await op('pay-reservation',{reservationId:s.reservationId,value:400,paymentMethod:'pix',accountId:'s2-bank'})
    s=await current(); expect(s.charges).toHaveLength(1); expect(stayBalance(s).balance).toBe(0)
    await op('check-out',{roomId:1}); expect((await current()).charges).toHaveLength(1)
  })
  it('restaura hospedagem, título e extrato com origens preservadas',async()=>{
    const s=await start(true,100); await op('stay-checkout',{stayId:s.id,recordVersion:s.recordVersion,dueDate:next(5),confirmed:true})
    const snapshot=await exportAllCollections(); await importAllCollections(snapshot,actor)
    const restored=await current(); expect(restored.id).toBe(s.id); expect(stayBalance(restored).balance).toBe(324)
    expect(await prisma.accountReceivable.count({where:{sourceStayId:s.id}})).toBe(1)
  })
  it('desconto após entrada atualiza conta uma vez e restaura seu ajuste sem duplicar o desconto',async()=>{
    const s=await start(true,100), request=randomUUID(), payload={reservationId:s.reservationId,type:'percent',value:10}
    await op('reservation-discount',payload,actor,request); await op('reservation-discount',payload,actor,request)
    const discounted=await current()
    expect(discounted.adjustments).toHaveLength(1); expect(discounted.adjustments![0].value).toBe(-40)
    expect(stayBalance(discounted).balance).toBe(284)
    await importAllCollections(await exportAllCollections(),actor)
    expect(stayBalance(await current()).balance).toBe(284)
  })
  it('restaura exportação anterior à Sprint 2 preservando sinal e consumo, sem baixar estoque novamente',async()=>{
    await start(true,100)
    const legacy=JSON.parse(await exportAllCollections()); delete legacy.stays
    await importAllCollections(JSON.stringify(legacy),actor)
    const restored=await current()
    expect(stayBalance(restored).balance).toBe(324); expect(restored.charges[0].productId).toBeNull()
    expect(Number((await prisma.stockItem.findUniqueOrThrow({where:{id:'s2-stock'}})).currentStock)).toBe(8)
  })
  it('reprecificação da troca conserva desconto anterior e recusa diárias abaixo do sinal recebido',async()=>{
    let s=await start(true,100)
    await op('reservation-discount',{reservationId:s.reservationId,type:'percent',value:10}); s=await current()
    await prisma.lodgingTariff.create({data:{id:'s2-destination',name:'Destino',roomId:2,roomType:'casal',minGuests:1,maxGuests:2,pricePerPerson:150,validFrom:new Date(next(-30))}})
    await op('stay-transfer',{stayId:s.id,recordVersion:s.recordVersion,roomId:2,effectiveDate:day,reason:'Troca com novas diárias',reprice:true})
    s=await current();expect(s.lodgingValue).toBe(560);expect(stayBalance(s).balance).toBe(484)
    await op('pay-reservation',{reservationId:s.reservationId,value:460,paymentMethod:'pix',accountId:'s2-bank'})
    s=await current();await op('release-room',{roomId:1})
    await expect(op('stay-transfer',{stayId:s.id,recordVersion:s.recordVersion,roomId:1,effectiveDate:day,reason:'Retorno com novas diárias',reprice:true})).rejects.toThrow('recebido')
    expect((await current()).roomId).toBe(2)
  })
})
