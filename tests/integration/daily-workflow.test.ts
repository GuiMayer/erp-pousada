import { beforeEach, afterAll, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { executeOperation } from "@/lib/server/operations"
import type { Actor } from "@/lib/server/auth"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import { businessDay } from "@/lib/utils/business-values"

if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw Error("Fluxo diário exige erp_test isolado")
const today = businessDay(), end = new Date(Date.parse(today) + 2 * 86400000).toISOString().slice(0, 10)
const actors: Actor[] = []
const op = (kind: string, payload: unknown, key = randomUUID(), actor = actors[0]) => executeOperation(actor, key, kind, payload)
const booking = {roomId:1,cpf:"52998224725",guestName:"Pessoa fictícia",guestCount:1,payerId:"person",checkIn:today,checkOut:end,totalValue:200}
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE customers, rooms, users, product_categories, transactions, bank_accounts, cash_closes, system_settings CASCADE')
  actors.length = 0
  for (let i = 0; i < 2; i++) {
    const user = await prisma.user.create({data:{id:`daily-${i}`,username:`daily-${i}`,fullName:"Operador de teste",role:"supervisor",password:"test-only",createdBy:"test"}})
    const session = await prisma.authSession.create({data:{userId:user.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+600000)}})
    actors.push({id:user.id,username:user.username,role:"supervisor",sessionId:session.id,approvedUntil:null,permissions:ALL_PERMISSIONS})
  }
  await prisma.customer.create({data:{id:"person",name:"Pessoa fictícia",cpfCnpj:booking.cpf,roles:["guest","payer"],active:true}})
  await prisma.guestProfile.create({data:{cpf:booking.cpf,name:booking.guestName,customerId:"person",totalStays:0,avgTicket:0,noShows:0}})
  await prisma.room.create({data:{id:1,number:"101",type:"Standard",capacity:2,status:"disponivel",timeline:[]}})
  await prisma.lodgingTariff.create({data:{id:"daily-rate",name:"Padrão",roomType:"Standard",minGuests:1,maxGuests:2,pricePerPerson:100,validFrom:new Date("2020-01-01")}})
  await prisma.bankAccount.create({data:{id:"bank",name:"Conta de teste",type:"corrente",active:true,initialBalance:0,currentBalance:0}})
  await prisma.productCategory.create({data:{id:"drinks",name:"Bebidas",icon:"Cup",color:"blue"}})
  await prisma.pOSProduct.create({data:{id:"water",name:"Água",price:12,categoryId:"drinks",trackStock:true}})
  await prisma.stockItem.create({data:{id:"stock",productId:"water",productName:"Água",unit:"un",currentStock:10,minimumStock:1,maximumStock:20,averageCost:3,lastPurchasePrice:3}})
  await prisma.stockLot.create({data:{id:"lot",productId:"water",code:"TEST",origin:"test",quantity:10,receivedQuantity:10,remainingValue:30,unitCost:3}})
})
afterAll(() => prisma.$disconnect())
const current = () => prisma.stay.findFirstOrThrow({where:{roomId:1},include:{charges:true,payments:true}})
async function arrive(deposit=0) {
  const reservation = await op("reserve",booking) as {id:string}
  if (deposit) await op("pay-reservation",{reservationId:reservation.id,value:deposit,paymentMethod:"pix",accountId:"bank"})
  const latest = await prisma.reservation.findUniqueOrThrow({where:{id:reservation.id}})
  await op("check-in",{...booking,reservationId:latest.id,recordVersion:latest.recordVersion})
  return current()
}

it("reserva com sinal, venda na ficha, parcial concorrente, quitação e fechamento reconciliam sem duplicação", async () => {
  const turn = await op("cash-open",{openingValue:100}) as {id:string}
  const stay = await arrive(50)
  const saleKey = randomUUID()
  const sale = {sale:{id:randomUUID(),items:[{id:randomUUID(),product:{id:"water"},quantity:2,discount:0}],total:24,amountPaid:0,stayId:stay.id,stayVersion:stay.recordVersion},globalDiscount:0}
  await op("sale",sale,saleKey); await op("sale",sale,saleKey)
  const delivered = await current()
  expect(delivered.charges).toHaveLength(1)
  expect(await prisma.pOSSale.count()).toBe(1)
  expect(Number((await prisma.stockItem.findUniqueOrThrow({where:{id:"stock"}})).currentStock)).toBe(8)
  expect(await prisma.transaction.count({where:{type:"receita"}})).toBe(1)
  const partial = {stayId:stay.id,recordVersion:delivered.recordVersion,value:100,payments:[{method:"pix",value:60,accountId:"bank"},{method:"dinheiro",value:40}]}
  const concurrent = await Promise.allSettled(actors.map(actor=>op("stay-receive",partial,randomUUID(),actor)))
  expect(concurrent.filter(result=>result.status==="fulfilled")).toHaveLength(1)
  expect(concurrent.find(result=>result.status==="rejected")).toMatchObject({reason:{status:409}})
  const remaining = await current(), receiptKey = randomUUID()
  const receipt = {stayId:stay.id,recordVersion:remaining.recordVersion,value:74,paymentMethod:"pix",accountId:"bank"}
  await op("stay-receive",receipt,receiptKey); await op("stay-receive",receipt,receiptKey)
  const settled = await current(), checkoutKey = randomUUID(), checkout = {stayId:stay.id,recordVersion:settled.recordVersion}
  await op("stay-checkout",checkout,checkoutKey); await op("stay-checkout",checkout,checkoutKey)
  await op("cash-close",{sessionId:turn.id,physicalValue:140})
  expect((await current()).status).toBe("closed")
  expect(Number((await prisma.stockItem.findUniqueOrThrow({where:{id:"stock"}})).currentStock)).toBe(8)
  expect(Number((await prisma.bankAccount.findUniqueOrThrow({where:{id:"bank"}})).currentBalance)).toBe(184)
  expect(Number((await prisma.transaction.aggregate({where:{type:"receita"},_sum:{value:true}}))._sum.value)).toBe(224)
  expect(Number((await prisma.cashClose.findUniqueOrThrow({where:{id:turn.id}})).divergence)).toBe(0)
})

it("caixa fechado entre a preparação e a confirmação recusa recebimento e preserva a hospedagem", async () => {
  const turn = await op("cash-open",{openingValue:100}) as {id:string}
  const stay = await arrive()
  const receipt = {stayId:stay.id,recordVersion:stay.recordVersion,value:20,paymentMethod:"dinheiro"}
  await op("cash-close",{sessionId:turn.id,physicalValue:100})
  const key = randomUUID()
  await expect(op("stay-receive",receipt,key)).rejects.toMatchObject({status:409})
  expect((await current()).payments).toHaveLength(0)
  expect(await prisma.transaction.count({where:{type:"receita"}})).toBe(0)
  await op("cash-open",{openingValue:100})
  await op("stay-receive",receipt,key)
  expect(Number((await prisma.transaction.aggregate({where:{type:"receita"},_sum:{value:true}}))._sum.value)).toBe(20)
})
