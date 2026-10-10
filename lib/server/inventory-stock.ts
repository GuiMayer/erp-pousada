import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { Actor } from './auth'
import { HttpError } from './http'
import { businessDay } from '@/lib/utils/business-values'
import { lotUsable } from '@/lib/inventory'
type Tx=Prisma.TransactionClient
const D=(n:Prisma.Decimal.Value)=>new Prisma.Decimal(n)
export async function stockProduct(tx:Tx,productId:string) {
  const product=await tx.pOSProduct.findUniqueOrThrow({where:{id:productId},include:{category:true}})
  if(product.category.isRestaurant||!product.trackStock)throw new HttpError(409,'Selecione uma bebida com controle de estoque')
  return product
}
export async function projectStock(tx:Tx,productId:string,lastPurchasePrice?:Prisma.Decimal.Value) {
  const product=await tx.pOSProduct.findUniqueOrThrow({where:{id:productId}})
  const totals=await tx.stockLot.aggregate({where:{productId},_sum:{quantity:true,remainingValue:true}}),quantity=totals._sum.quantity??D(0),value=totals._sum.remainingValue??D(0)
  const fields={currentStock:quantity,averageCost:quantity.gt(0)?value.div(quantity).toDecimalPlaces(2):D(0),...(lastPurchasePrice===undefined?{}:{lastPurchasePrice:D(lastPurchasePrice).toDecimalPlaces(2),lastPurchaseDate:new Date()})}
  await tx.stockItem.upsert({where:{productId},create:{id:randomUUID(),productId,productName:product.name,unit:product.unit,minimumStock:0,maximumStock:0,lastPurchasePrice:0,...fields},update:fields})
}
export async function lotMovement(tx:Tx,actor:Actor,lotId:string,delta:Prisma.Decimal.Value,reason:string,originType:string,originId:string,positiveValue?:Prisma.Decimal.Value) {
  const lot=await tx.stockLot.findUniqueOrThrow({where:{id:lotId},include:{product:true}}),amount=D(delta)
  if(!amount.equals(amount.toDecimalPlaces(3))||lot.quantity.plus(amount).lt(0))throw new HttpError(409,'Saldo físico insuficiente no lote; confira movimentos posteriores à contagem')
  const value=amount.lt(0)?(amount.abs().equals(lot.quantity)?lot.remainingValue:lot.remainingValue.mul(amount.abs()).div(lot.quantity).toDecimalPlaces(2)).negated():D(positiveValue??lot.unitCost.mul(amount).toDecimalPlaces(2))
  await tx.stockLot.update({where:{id:lot.id},data:{quantity:{increment:amount},remainingValue:{increment:value}}})
  const movement=await tx.stockMovement.create({data:{id:randomUUID(),productId:lot.productId,productName:lot.product.name,quantity:amount.abs(),unit:lot.product.unit,type:amount.lt(0)?(originType==='loss'?'perda':'saida'):'entrada',cost:amount.isZero()?0:value.abs().div(amount.abs()).toDecimalPlaces(2),reason,originType,originId,timestamp:new Date(),registeredBy:actor.username,allocations:{create:[{id:randomUUID(),lotId,delta:amount,value}]}}})
  await projectStock(tx,lot.productId)
  return {movement,value:value.abs()}
}
export async function issueStock(tx:Tx,productId:string,quantity:number,actor:Actor,reference:string) {
  const product=await tx.pOSProduct.findUniqueOrThrow({where:{id:productId}})
  if(!product.trackStock)return
  await stockProduct(tx,productId)
  const lots=await tx.stockLot.findMany({where:{productId,quantity:{gt:0}},orderBy:[{expiresAt:{sort:'asc',nulls:'last'}},{receivedAt:'asc'},{id:'asc'}]})
  const available=lots.filter(l=>lotUsable({status:l.status,expiresAt:l.expiresAt?.toISOString()??null},businessDay(),product.requiresExpiry))
  if(available.reduce((s,l)=>s.plus(l.quantity),D(0)).lt(quantity))throw new HttpError(409,`Estoque utilizável insuficiente: ${product.name}. Revise lotes, validade e abertura.`)
  let remaining=D(quantity)
  for(const lot of available){const take=Prisma.Decimal.min(remaining,lot.quantity);if(take.gt(0))await lotMovement(tx,actor,lot.id,take.negated(),reference,'consumption',reference);remaining=remaining.minus(take);if(remaining.isZero())break}
}
export async function restoreStock(tx:Tx,productId:string,quantity:number,actor:Actor,reference:string,originalReference:string) {
  const product=await tx.pOSProduct.findUniqueOrThrow({where:{id:productId}});if(!product.trackStock)return
  const originals=await tx.stockMovement.findMany({where:{productId,reason:originalReference,type:'saida'},include:{allocations:true}})
  if(!originals.length||!originals.reduce((s,m)=>s.plus(m.quantity),D(0)).equals(quantity)||originals.some(m=>!m.allocations.length))throw new HttpError(409,'Saída sem rastreabilidade de lote; faça a revisão pelo inventário')
  for(const source of originals){if(await tx.stockMovement.count({where:{sourceMovementId:source.id}}))throw new HttpError(409,'Mercadoria já devolvida ao estoque')
    // A financial reversal never selects a new expiry: physical return restores its original lot/cost.
    const entries=[]
    for(const a of source.allocations){await tx.stockLot.update({where:{id:a.lotId},data:{quantity:{increment:a.delta.abs()},remainingValue:{increment:a.value.abs()}}});entries.push({id:randomUUID(),lotId:a.lotId,delta:a.delta.abs(),value:a.value.abs()})}
    await tx.stockMovement.create({data:{id:randomUUID(),type:'entrada',sourceMovementId:source.id,productId,productName:product.name,quantity:source.quantity,unit:source.unit,cost:source.cost,reason:reference,originType:'customer-return',originId:originalReference,timestamp:new Date(),registeredBy:actor.username,allocations:{create:entries}}})
  }
  await projectStock(tx,productId)
}
export async function quarantineUnmappedStock(tx:Tx) {
  const stocks=await tx.stockItem.findMany({where:{currentStock:{gt:0}},include:{product:{include:{category:true,lots:true}}}})
  for(const stock of stocks)if(!stock.product.category.isRestaurant&&!stock.product.lots.length)await tx.stockLot.create({data:{id:randomUUID(),productId:stock.productId,code:'ABERTURA-'+stock.id,status:'unverified',origin:'legacy',quantity:stock.currentStock,receivedQuantity:stock.currentStock,remainingValue:stock.currentStock.mul(stock.averageCost).toDecimalPlaces(2),unitCost:stock.averageCost,costEstimated:true,reason:'Saldo anterior: revisar lote e validade'}})
}
