import { inventoryOperation } from './inventory-operations'
import { issueStock,restoreStock } from './inventory-stock'
import { ensureStay, roomStay, stayOperation, finishStay, receiveStay, mapStay } from "./stays"
import { stayBalance } from "@/lib/stays"
import { ensureGuest } from "./contacts"
import { agreedPrice } from "./lodging-pricing"
import { requireVersion, retryDelay } from "./concurrency"
import { logEvent, setLogOperation } from "./logging"
import { recordAudit } from "./audit"
import { emitOperation } from "./notifications/service"
import { evaluateStock, evaluateTimed } from "./notifications/rules"
import { approvalResourceHash, approvalReview } from "./approval-scope"
import { effectivePermissions } from "@/lib/permissions"
import { demand, demandOperation, DELEGATABLE } from "./permissions"
import { financeOperation, recordLedger, paymentFields, paymentLinesSchema, postPayments } from "./business-finance"
import { normalizePayment, businessMonthBounds, netItemValues } from "../utils/business-values"
import { unitFactor } from "../utils/units"
import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { cpf as cpfValidator } from "cpf-cnpj-validator"
import { prisma } from "@/lib/db/client"
import type { Actor } from "./auth"
import { hashToken } from "./auth"
import { HttpError } from "./http"
import { collectionMapper, createCollectionItem, updateCollectionItem } from "./db/relational-data-service"

const text = z.string().trim().min(1).max(200)
const money = z.number().finite().nonnegative().max(999999999).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use no máximo duas casas decimais")
const id = text
const cpf = z.string().max(18).transform(value => value.replace(/\D/g, "")).refine(value => cpfValidator.isValid(value), "CPF inválido")
const integer = z.number().int().positive().max(100000)
const percent = z.number().finite().min(0).max(100)
const payment = z.enum(["dinheiro", "pix", "debito", "credito", "Dinheiro", "PIX", "Cartao Debito", "Cartao Credito", "Cartão Débito", "Cartão Crédito"])
const cartItem = z.object({ id, product: z.object({ id }).passthrough(), quantity: integer, discount: percent }).passthrough()
const saleInput = z.object({ sale: z.object({ id, items: z.array(cartItem).min(1).max(100), total: money, paymentMethod: payment.optional(), payments: paymentLinesSchema.optional(), stayId:id.optional(), stayVersion:z.number().int().nonnegative().optional(), accountId: id.optional(), amountPaid: money, customer: z.string().max(200).optional() }).passthrough(), globalDiscount: percent })
const checkinInput = z.object({ guestCount: z.number().int().min(1).max(100).optional(), payerId: id.optional(), priceExceptionReason: z.string().trim().min(5).max(500).optional(), roomId: integer, cpf, guestName: text, checkIn: z.string().date(), checkOut: z.string().date(), totalValue: money }).strict()
const decimal = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n)
const round = (n: Prisma.Decimal) => n.toDecimalPlaces(2)
type Tx = Prisma.TransactionClient

const audit = recordAudit
async function assertPayer(tx: Tx, payerId: string) {
  const payer = await tx.customer.findUnique({ where: { id: payerId } })
  if (!payer?.active || !Array.isArray(payer.roles) || !payer.roles.includes("payer")) throw new HttpError(409, "Selecione uma pessoa ativa com papel de pagador")
}
async function checkDiscount(tx: Tx, actor: Actor, value: number) {
  const settings = await tx.systemSettings.findFirst()
  if (value - (settings?.discountCeiling ?? 0) > 0.000001) demand(actor, "discount.override")
}
async function moveStock(tx: Tx, productId: string, quantity: number, actor: Actor, reference: string, restore = false) {
  if(restore)await restoreStock(tx,productId,quantity,actor,reference,reference.replace('Estorno ','Venda '))
  else await issueStock(tx,productId,quantity,actor,reference)
}
const operationIsInventory=(kind:string)=>['purchase-receive','purchase-return','return-settle','stock-opening','lot-review','stock-loss','inventory-post','inventory-start'].includes(kind)
const ledger = recordLedger

async function assertRoomPeriod(tx: Tx, room: { id: number; status: string; blockEndDate: Date | null }, start: Date, end: Date) {
  if (end <= start) throw new HttpError(400, "Período inválido")
  if (room.status === "bloqueado" && (!room.blockEndDate || start <= room.blockEndDate)) throw new HttpError(409, "Período coincide com bloqueio do quarto")
}

export async function applyOperation(tx: Tx, actor: Actor, kind: string, payload: unknown): Promise<unknown> {
  setLogOperation(kind)
  demandOperation(actor, kind)
  const stayResult = await stayOperation(tx, actor, kind, payload)
  if (stayResult !== undefined) return stayResult
  const financeResult = await financeOperation(tx, actor, kind, payload)
  if (financeResult !== undefined) return financeResult
  const inventoryResult=await inventoryOperation(tx,actor,kind,payload)
  if(inventoryResult!==undefined)return inventoryResult
  if (kind === "reserve-group") {
    const input = z.object({ payerId: id.optional(), rooms: z.array(z.object({ guestCount: z.number().int().min(1).max(100).optional(), priceExceptionReason: z.string().trim().min(5).max(500).optional(), roomId: integer, totalValue: money })).min(1).max(50), cpf, guestName: text, checkIn: z.string().date(), checkOut: z.string().date() }).strict().parse(payload)
    if (new Set(input.rooms.map(room => room.roomId)).size !== input.rooms.length) throw new HttpError(400, "Quartos repetidos")
    const results = []
    const groupId = randomUUID()
    for (const room of input.rooms) results.push(await applyOperation(tx, actor, "reserve", { ...room, payerId: input.payerId, cpf: input.cpf, guestName: input.guestName, checkIn: input.checkIn, checkOut: input.checkOut }))
    for (const result of results) await tx.reservation.update({ where: { id: (result as { id: string }).id }, data: { groupId } })
    return results
  }
  if (kind === "sale") {
    const { sale, globalDiscount } = saleInput.parse(payload)
    await checkDiscount(tx, actor, Math.max(...sale.items.map(i => 100 * (1 - (1 - i.discount / 100) * (1 - globalDiscount / 100)))))
    const products = await tx.pOSProduct.findMany({ where: { id: { in: sale.items.map(i => i.product.id) } } })
    let subtotal = decimal(0)
    const items = sale.items.map(item => {
      const product = products.find(p => p.id === item.product.id)
      if (!product || !product.active) throw new HttpError(404, "Produto inativo ou não encontrado")
      const itemSubtotal = round(product.price.mul(item.quantity).mul(decimal(1).minus(decimal(item.discount).div(100))))
      subtotal = subtotal.plus(itemSubtotal)
      return { id: item.id, productId: product.id, quantity: item.quantity, discount: item.discount, unitPrice: product.price, subtotal: itemSubtotal }
    })
    const discount = round(subtotal.mul(globalDiscount).div(100))
    const total = round(subtotal.minus(discount))
    if (!total.equals(round(decimal(sale.total)))) throw new HttpError(409, "Preço alterado. Atualize o carrinho.")
    const stay=sale.stayId?await tx.stay.findUniqueOrThrow({where:{id:sale.stayId},include:{occupants:true,allocations:true,charges:true,payments:true,adjustments:true}}):null
    if(stay) {
      demand(actor,'consumptions.create');requireVersion(sale.stayVersion,stay.recordVersion)
      if(stay.status!=='active')throw new HttpError(409,'Hospedagem encerrada')
      if(sale.payments?.length||sale.amountPaid!==0)throw new HttpError(400,'Lançamento na hospedagem não recebe no PDV')
    }
    const paid=stay?null:await postPayments(tx,actor,`Venda ${sale.id}`,Number(total),{paymentMethod:sale.paymentMethod,accountId:sale.accountId,payments:sale.payments??(sale.paymentMethod?[{method:sale.paymentMethod,value:sale.amountPaid,accountId:sale.accountId}]:undefined)},'sale',sale.id)
    for (const item of items) await moveStock(tx, item.productId, item.quantity, actor, `Venda ${sale.id}`)
    const result = await tx.pOSSale.create({ data: { id: sale.id, date: new Date(), subtotal, discount, total, stayId:stay?.id,payments:paid?.lines,paymentMethod: stay?'Conta da hospedagem':(paid!.lines.length>1?'Misto':paid!.lines[0].method), amountPaid: paid?.offered??0, change:paid?.change??0, customer: stay?.guestName??sale.customer, operator: actor.username, status: "concluida", items: { create: items } }, include: { items: { include: { product: true } } } })
    if(stay) {
      const amounts=netItemValues({total:Number(total),items:sale.items.map(i=>({...i,product:{price:Number(products.find(p=>p.id===i.product.id)!.price)}}))})
      const projection=await tx.roomConsumption.upsert({where:{roomId:stay.roomId},create:{id:randomUUID(),roomId:stay.roomId},update:{}})
      for(let index=0;index<items.length;index++) {
        const item=items[index],product=products.find(p=>p.id===item.productId)!
        await tx.stayCharge.create({data:{id:item.id,stayId:stay.id,sourceSaleId:sale.id,productId:product.id,label:product.name,unitPrice:item.unitPrice,quantity:item.quantity,lineTotal:amounts[index]}})
        await tx.roomConsumptionItem.create({data:{id:item.id,consumptionId:projection.id,label:`${item.quantity} × ${product.name} (PDV)`,unitPrice:amounts[index],quantity:1}})
      }
      await tx.stay.update({where:{id:stay.id},data:{recordVersion:{increment:1}}})
    }
    await audit(tx, actor, "Venda finalizada", sale.id, { entityType: "posSales", entityId: sale.id, operation: "create" })
    return collectionMapper("posSales").toApp(result)
  }
  if (kind === "cancel-sale") {
    demandOperation(actor, kind)
    const input = z.object({ saleId: id, reason: text, returnToStock: z.boolean() }).strict().parse(payload)
    const sale = await tx.pOSSale.findUniqueOrThrow({ where: { id: input.saleId }, include: { items: true } })
    if (sale.status !== "concluida") throw new HttpError(409, "Venda já estornada")
    if(sale.stayId) {
      const stay=await tx.stay.findUniqueOrThrow({where:{id:sale.stayId},include:{occupants:true,allocations:true,charges:true,payments:true,adjustments:true}})
      const charges=stay.charges.filter(c=>c.sourceSaleId===sale.id&&c.status==='active')
      const value=charges.reduce((sum,c)=>sum+Number(c.lineTotal??c.unitPrice.mul(c.quantity)),0)
      if(stay.status!=='active'||value>stayBalance(mapStay(stay)).consumptionBalance)throw new HttpError(409,'Consumo já recebido ou estadia encerrada; concilie a hospedagem antes de corrigir')
      await tx.stayCharge.updateMany({where:{sourceSaleId:sale.id},data:{status:'corrected',reason:input.reason}})
      await tx.roomConsumptionItem.deleteMany({where:{id:{in:charges.map(c=>c.id)}}})
      await tx.stay.update({where:{id:stay.id},data:{recordVersion:{increment:1}}})
    }else{
      const receipts=await tx.transaction.findMany({where:{refId:`Venda ${sale.id}`,type:'receita'}})
      if((!receipts.length && sale.total.gt(0))||!receipts.reduce((sum,p)=>sum.plus(p.value),decimal(0)).equals(sale.total))throw new HttpError(409,'Recebimentos não conciliados; revise antes de estornar')
      for(const original of receipts) {
        if(await tx.transaction.count({where:{reversalOfId:original.id}}))throw new HttpError(409,'Recebimento já estornado')
        await ledger(tx,actor,`Estorno ${sale.id}`,original.value,'estorno',original.paymentMethod??undefined,original.accountId??undefined,{originType:'sale-refund',originId:sale.id,reversalOfId:original.id})
      }
    }
    if (input.returnToStock) {
      const quantities=new Map<string,number>()
      for(const item of sale.items)quantities.set(item.productId,(quantities.get(item.productId)??0)+item.quantity)
      for(const [productId,quantity] of quantities)await moveStock(tx,productId,quantity,actor,`Estorno ${sale.id}`,true)
    }
    await tx.pOSSale.update({ where: { id: sale.id }, data: { status: 'cancelada', cancelReason: input.reason } })
    await audit(tx, actor, "Venda estornada", `${sale.id}: ${input.reason}`, { entityType: "posSales", entityId: sale.id, operation: "update", metadata: { reason: input.reason } })
    return { success: true }
  }
  if (kind === "reserve" || kind === "edit-reservation") {
    const input = z.object({ guestCount: z.number().int().min(1).max(100).optional(), payerId: id.optional(), priceExceptionReason: z.string().trim().min(5).max(500).optional(), id: id.optional(), roomId: integer, cpf, guestName: text, checkIn: z.string().date(), checkOut: z.string().date(), totalValue: money, status: z.enum(["confirmada", "cancelada", "noshow"]).default("confirmada"), cancelTreatment: z.string().max(200).optional(), recordVersion: z.number().int().nonnegative().optional() }).strict().parse(payload)
    const checkIn = new Date(input.checkIn), checkOut = new Date(input.checkOut)
    if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) || checkOut <= checkIn) throw new HttpError(400, "Período inválido")
    const room = await tx.room.findUniqueOrThrow({ where: { id: input.roomId } })
    let originalValue = decimal(input.totalValue)
    let current: Awaited<ReturnType<typeof tx.reservation.findUniqueOrThrow>> | null = null
    if (kind === "edit-reservation") {
      current = await tx.reservation.findUniqueOrThrow({ where: { id: input.id } })
      requireVersion(input.recordVersion, current.recordVersion)
      originalValue = Prisma.Decimal.max(current.originalValue ?? current.totalValue, current.totalValue, input.totalValue)
      if (current.status !== "confirmada") throw new HttpError(409, "Somente reserva confirmada pode ser editada")
      if (input.totalValue < Number(current.totalValue)) await checkDiscount(tx, actor, Number((current.originalValue ?? current.totalValue).minus(input.totalValue).div(current.originalValue ?? current.totalValue).mul(100)))
      if (current.paidValue.gt(input.totalValue)) throw new HttpError(409, "Valor inferior ao recebido; faça a conciliação antes")
    }
    if (input.status !== "confirmada") throw new HttpError(400, "Utilize o fluxo de cancelamento ou no-show")
    await assertRoomPeriod(tx, room, checkIn, checkOut)
    if (input.status === "confirmada") {
      const overlap = await tx.reservation.count({ where: { ...(kind === "edit-reservation" ? { id: { not: input.id } } : {}), roomId: room.id, status: { in: ["confirmada", "checkin"] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } } })
      if (overlap) throw new HttpError(409, "Reserva conflita com outra hospedagem")
    }
    const nightlyPrices = await agreedPrice(tx, actor, input, current)
    if (room.capacity && input.guestCount === undefined && !current) throw new HttpError(400, "Informe a quantidade de hóspedes")
    const guest = await ensureGuest(tx, actor, input.cpf, input.guestName)
    if (current?.paidValue.gt(0) && current.cpf !== guest.cpf) throw new HttpError(409, "Reserva paga não permite trocar o titular")
    const payerId = input.payerId ?? current?.payerId ?? guest.customerId!
    await assertPayer(tx, payerId)
    const { recordVersion: _version, ...fields } = input
    const data = { ...fields, guestName: guest.name, cpf: guest.cpf, payerId, nightlyPrices, id: input.id || randomUUID(), checkIn, checkOut, roomNumber: room.number, originalValue }
    const result = kind === "reserve" ? await tx.reservation.create({ data }) : await tx.reservation.update({ where: { id: input.id }, data: { ...data, recordVersion: { increment: 1 } } })
    await audit(tx, actor, kind === "reserve" ? "Reserva criada" : "Reserva alterada", result.id, { entityType: "reservations", entityId: result.id, operation: kind === "reserve" ? "create" : "update" })
    return collectionMapper("reservations").toApp(result)
  }
  if (kind === "check-in") {
    const input = checkinInput.parse(payload)
    const checkIn = new Date(input.checkIn), checkOut = new Date(input.checkOut)
    if (checkOut <= checkIn) throw new HttpError(400, "Período inválido")
    const room = await tx.room.findUniqueOrThrow({ where: { id: input.roomId } })
    if (room.status !== "disponivel") throw new HttpError(409, "Quarto indisponível")
    if (await tx.roomConsumption.count({ where: { roomId: room.id } })) throw new HttpError(409, "Consumo legado sem hospedagem: regularize antes de ocupar o quarto")
    await assertRoomPeriod(tx, room, checkIn, checkOut)
    const guest = await ensureGuest(tx, actor, input.cpf, input.guestName)
    const existing = await tx.reservation.findFirst({ where: { roomId: room.id, cpf: guest.cpf, status: "confirmada", checkIn: new Date(input.checkIn), checkOut: new Date(input.checkOut) } })
    if (existing && !existing.totalValue.equals(input.totalValue)) throw new HttpError(409, "Use o valor confirmado da reserva ou edite-a antes do check-in")
    const overlap = await tx.reservation.count({ where: { ...(existing ? { id: { not: existing.id } } : {}), roomId: room.id, status: { in: ["confirmada", "checkin"] }, checkIn: { lt: new Date(input.checkOut) }, checkOut: { gt: new Date(input.checkIn) } } })
    if (overlap) throw new HttpError(409, "Reserva conflita com outra hospedagem")
    const nightlyPrices = existing ? existing.nightlyPrices ?? undefined : await agreedPrice(tx, actor, input)
    if (!existing && room.capacity && input.guestCount === undefined) throw new HttpError(400, "Informe a quantidade de hóspedes")
    if (existing && input.guestCount !== undefined && input.guestCount !== existing.guestCount) throw new HttpError(409, "Ocupação diferente da reserva; edite-a antes do check-in")
    if (existing && input.payerId !== undefined && input.payerId !== existing.payerId) throw new HttpError(409, "Pagador diferente da reserva; edite-a antes do check-in")
    const payerId = existing?.payerId ?? input.payerId ?? guest.customerId!
    if (!existing) await assertPayer(tx, payerId)
    await tx.guestProfile.update({ where: { cpf: guest.cpf }, data: { totalStays: { increment: 1 } } })
    await tx.room.update({ where: { id: room.id }, data: { status: "ocupado", guest: guest.name, guestCpf: guest.cpf, checkIn: new Date(input.checkIn), checkOut: new Date(input.checkOut) } })
    const reservation = existing ? await tx.reservation.update({ where: { id: existing.id }, data: { status: "checkin" } }) : await tx.reservation.create({ data: { id: randomUUID(), roomId: room.id, roomNumber: room.number, guestName: guest.name, cpf: guest.cpf, guestCount: input.guestCount, payerId, nightlyPrices, priceExceptionReason: input.priceExceptionReason, checkIn: new Date(input.checkIn), checkOut: new Date(input.checkOut), status: "checkin", totalValue: input.totalValue, originalValue: input.totalValue } })
    await ensureStay(tx, reservation.id)
    await audit(tx, actor, "Check-in realizado", `${room.number}: ${reservation.id}`, { entityType: "reservations", entityId: reservation.id, operation: "update" })
    return collectionMapper("reservations").toApp(reservation)
  }
  if (kind === "check-out" || kind === "release-room") {
    const { roomId } = z.object({ roomId: integer }).strict().parse(payload)
    const room = await tx.room.findUniqueOrThrow({ where: { id: roomId } })
    if (kind === "release-room") {
      if (room.status !== "limpeza") throw new HttpError(409, "Quarto não está em limpeza")
      await tx.room.update({ where: { id: roomId }, data: { status: "disponivel" } })
    } else {
      if (room.status !== "ocupado") throw new HttpError(409, "Quarto não está ocupado")
      const stay = await roomStay(tx, roomId)
      if (stayBalance(mapStay(stay)).balance > 0) throw new HttpError(409, "Quite a hospedagem e o consumo antes do check-out ou utilize saída empresarial autorizada")
      await finishStay(tx, actor, stay)
    }
    await audit(tx, actor, kind === "release-room" ? "Quarto liberado" : "Check-out realizado", room.number, { entityType: "rooms", entityId: String(room.id), operation: "update" })
    return { success: true }
  }
  if (kind === "add-consumption") {
    const { roomId, item } = z.object({ roomId: integer, item: z.object({ id, productId: id.optional(), label: text, unitPrice: money, quantity: integer }) }).strict().parse(payload)
    const room = await tx.room.findUniqueOrThrow({ where: { id: roomId } })
    if (room.status !== "ocupado") throw new HttpError(409, "Quarto não está ocupado")
    const product = item.productId ? await tx.pOSProduct.findUnique({ where: { id: item.productId } }) : await tx.pOSProduct.findFirst({ where: { name: item.label } })
    if (item.productId && !product) throw new HttpError(404, "Produto não encontrado")
    if (product && !product.active) throw new HttpError(409, "Bebida inativa; selecione um produto disponível")
    if (product) item.unitPrice = Number(product.price)
    else demand(actor, "consumptions.custom")
    if (product) await moveStock(tx, product.id, item.quantity, actor, `Consumo quarto ${room.number} · ${item.id}`)
    const stay = await roomStay(tx, roomId)
    await tx.stayCharge.create({ data: { id: item.id, stayId: stay.id, productId: product?.id, label: product?.name ?? item.label, unitPrice: item.unitPrice, quantity: item.quantity } })
    await tx.stay.update({ where: { id: stay.id }, data: { recordVersion: { increment: 1 } } })
    const consumption = await tx.roomConsumption.upsert({ where: { roomId }, create: { id: randomUUID(), roomId }, update: {} })
    await tx.roomConsumptionItem.create({ data: { id: item.id, label: product?.name ?? item.label, unitPrice: item.unitPrice, quantity: item.quantity, consumptionId: consumption.id } })
    await audit(tx, actor, "Consumo lançado", `${room.number}: ${item.label}`, { entityType: "consumptions", entityId: item.id, operation: "create" })
    return { success: true }
  }
  if (kind === "remove-consumption") {
    demandOperation(actor, kind)
    const input = z.object({ roomId: integer, itemId: id }).strict().parse(payload)
    const item = await tx.roomConsumptionItem.findUniqueOrThrow({ where: { id: input.itemId }, include: { consumption: true } })
    if (item.consumption.roomId !== input.roomId) throw new HttpError(404, "Item não encontrado")
    const stay = await roomStay(tx, input.roomId)
    const charge = stay.charges.find(c => c.id === input.itemId && c.status === "active")
    if (!charge) throw new HttpError(409, "Consumo legado precisa de revisão")
    if(charge.sourceSaleId)throw new HttpError(409,"Consumo originado no PDV; utilize o estorno da venda")
    if (stayBalance(mapStay(stay)).consumptionBalance < Number(charge.unitPrice) * charge.quantity) throw new HttpError(409, "Item possui recebimento; concilie antes de corrigir")
    await tx.stayCharge.update({ where: { id: charge.id }, data: { status: "corrected", reason: "Correção autorizada; sem retorno físico" } })
    await tx.stay.update({ where: { id: stay.id }, data: { recordVersion: { increment: 1 } } })
    // Removal is a billing correction; consumed goods are not returned to inventory.
    await tx.roomConsumptionItem.delete({ where: { id: item.id } })
    await audit(tx, actor, "Consumo removido", `${input.roomId}: ${item.label}`, { entityType: "consumptions", entityId: item.id, operation: "delete" })
    return { success: true }
  }
  if (kind === "pay-consumption") {
    const { roomId, paymentMethod, accountId, payments } = z.object({ roomId: integer, ...paymentFields }).strict().parse(payload)
    const stay = await roomStay(tx, roomId)
    const total = stayBalance(mapStay(stay)).consumptionBalance
    if (total <= 0) throw new HttpError(409, "Consumo já quitado")
    await receiveStay(tx, actor, stay, total, paymentMethod, accountId, "consumption",payments)
    await audit(tx, actor, "Consumo quitado", String(roomId), { entityType: "consumptions", entityId: String(roomId), operation: "action" })
    return { success: true }
  }
  if (kind === "open-table") {
    const { tableId, orderId } = z.object({ tableId: integer, orderId: id }).strict().parse(payload)
    const table = await tx.restaurantTable.findUniqueOrThrow({ where: { id: tableId } })
    if (table.status === "ocupada") throw new HttpError(409, "Mesa ocupada")
    const order = await tx.restaurantOrder.create({ data: { id: orderId, tableId, tableNumber: table.number, subtotal: 0, discount: 0, total: 0, status: "aberta", openedAt: new Date(), operator: actor.username }, include: { items: true } })
    await tx.restaurantTable.update({ where: { id: tableId }, data: { status: "ocupada", currentOrderId: orderId, openedAt: new Date() } })
    await audit(tx, actor, "Mesa aberta", table.number, { entityType: "restaurantOrders", entityId: order.id, operation: "create" })
    return collectionMapper("restaurantOrders").toApp(order)
  }
  if (kind === "edit-order") {
    const input = z.object({ orderId: id, expectedVersion: z.number().int().nonnegative(), items: z.array(z.object({ id, productId: id, quantity: integer }).passthrough()).max(100), discountPercent: percent.default(0) }).strict().parse(payload)
    const order = await tx.restaurantOrder.findUniqueOrThrow({ where: { id: input.orderId }, include: { items: true } })
    if (order.status !== "aberta") throw new HttpError(409, "Comanda não está aberta")
    if (order.version !== input.expectedVersion) throw new HttpError(409, "Comanda alterada em outro dispositivo. Atualize antes de editar.")
    await checkDiscount(tx, actor, input.discountPercent)
    const products = await tx.pOSProduct.findMany({ where: { id: { in: input.items.map(i => i.productId) } }, include: { category: true } })
    const items = input.items.map(item => {
      const product = products.find(p => p.id === item.productId)
      if (!product) throw new HttpError(404, "Produto não encontrado")
      const previous = order.items.find(row => row.id === item.id)
      if (previous && previous.productId !== product.id) throw new HttpError(409, "Item não pode trocar de produto")
      const unitPrice = previous?.unitPrice ?? product.price
      return { id: item.id, productId: product.id, quantity: item.quantity, productName: previous?.productName ?? product.name, unitPrice, subtotal: unitPrice.mul(item.quantity), category: previous?.category ?? product.category.name }
    })
    const subtotal = items.reduce((sum,i) => sum.plus(i.subtotal), decimal(0))
    const discount = round(subtotal.mul(input.discountPercent).div(100))
    await tx.restaurantOrderItem.deleteMany({ where: { orderId: order.id } })
    await tx.restaurantOrder.update({ where: { id: order.id }, data: { version: { increment: 1 }, items: { create: items }, subtotal, discount, total: subtotal.minus(discount) } })
    await audit(tx, actor, "Comanda editada", order.id, { entityType: "restaurantOrders", entityId: order.id, operation: "update", metadata: { before: { items: order.items, subtotal: Number(order.subtotal), discount: Number(order.discount), total: Number(order.total), version: order.version }, after: { items, subtotal: Number(subtotal), discount: Number(discount), total: Number(subtotal.minus(discount)), version: (await tx.restaurantOrder.findUniqueOrThrow({ where: { id: order.id } })).version } } })
    return { success: true }
  }
  if (kind === "close-order" || kind === "cancel-order") {
    const input = z.object({ orderId: id, expectedVersion: z.number().int().nonnegative(), accountId: id.optional(), paymentMethod: payment.optional(), amountPaid: money.optional(), discountPercent: percent.default(0), customer: z.string().max(200).optional(), reason: text.optional() }).strict().parse(payload)
    const order = await tx.restaurantOrder.findUniqueOrThrow({ where: { id: input.orderId }, include: { items: true } })
    if (order.status !== "aberta") throw new HttpError(409, "Comanda já encerrada")
    if (order.version !== input.expectedVersion) throw new HttpError(409, "Comanda alterada; atualize antes de encerrar")
    if (kind === "close-order") {
      if (!order.items.length || !input.paymentMethod) throw new HttpError(400, "Comanda sem itens ou pagamento")
      const total = order.total
      if (input.amountPaid === undefined || decimal(input.amountPaid).lt(total)) throw new HttpError(400, "Pagamento insuficiente")
      for (const item of order.items) await moveStock(tx, item.productId, item.quantity, actor, `Comanda ${order.id}`)
      await tx.restaurantOrder.update({ where: { id: order.id }, data: { status: "fechada", total, discount: order.discount, paymentMethod: normalizePayment(input.paymentMethod), amountPaid: input.amountPaid, change: normalizePayment(input.paymentMethod) === "Dinheiro" ? decimal(input.amountPaid).minus(total) : 0, customer: input.customer, closedAt: new Date() } })
      await ledger(tx, actor, `Comanda ${order.id}`, total, "receita", input.paymentMethod, input.accountId)
    } else {
      demand(actor, "restaurant.cancel")
      if (!input.reason) throw new HttpError(400, "Informe o motivo do cancelamento")
      await tx.restaurantOrder.update({ where: { id: order.id }, data: { status: "cancelada", cancelReason: input.reason, closedAt: new Date() } })
    }
    await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: "livre", currentOrderId: null, openedAt: null } })
    await audit(tx, actor, kind === "close-order" ? "Comanda fechada" : "Comanda cancelada", order.id, { entityType: "restaurantOrders", entityId: order.id, operation: "update" })
    return { success: true }
  }
  if (kind === "table-status") {
    const input = z.object({ tableId: integer, status: z.enum(["livre", "reservada"]) }).strict().parse(payload)
    const table = await tx.restaurantTable.findUniqueOrThrow({ where: { id: input.tableId } })
    if (table.status === "ocupada") throw new HttpError(409, "Encerre a comanda primeiro")
    await tx.restaurantTable.update({ where: { id: input.tableId }, data: { status: input.status } })
    await audit(tx, actor, "Estado da mesa alterado", table.number, { entityType: "restaurantTables", entityId: String(table.id), operation: "update", metadata: { before: { status: table.status }, after: { status: input.status } } })
    return { success: true }
  }
  if(kind==='stock-movement')throw new HttpError(409,'Use recebimento de compra, perda por lote, abertura ou inventário. O saldo não pode ser sobrescrito.')
  if (kind === "reservation-discount") {
    const input = z.object({ reservationId: id, type: z.enum(["percent", "fixed"]), value: money }).strict().parse(payload)
    const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: input.reservationId } })
    if (!["confirmada", "checkin"].includes(reservation.status) || reservation.totalValue.lte(0)) throw new HttpError(409, "Reserva não permite desconto")
    const amount = input.type === "percent" ? round(reservation.totalValue.mul(input.value).div(100)) : decimal(input.value)
    if (amount.gt(reservation.totalValue)) throw new HttpError(400, "Desconto excede o valor da reserva")
    if (reservation.paidValue.gt(reservation.totalValue.minus(amount))) throw new HttpError(409, "Desconto deixaria recebimento excedente")
    const original = reservation.originalValue ?? reservation.totalValue
    await checkDiscount(tx, actor, Number(original.minus(reservation.totalValue.minus(amount)).div(original).mul(100)))
    await tx.reservation.update({ where: { id: reservation.id }, data: { totalValue: reservation.totalValue.minus(amount) } })
    const stay = await tx.stay.findUnique({ where: { reservationId: reservation.id } })
    if (stay && amount.gt(0)) {
      await tx.stayAdjustment.create({ data: { id: randomUUID(), stayId: stay.id, value: amount.negated(), reason: `Desconto autorizado por ${actor.username}` } })
      await tx.stay.update({ where: { id: stay.id }, data: { lodgingValue: reservation.totalValue.minus(amount), recordVersion: { increment: 1 } } })
    }
    await audit(tx, actor, "Desconto em reserva", `${reservation.id}: ${amount}`, { entityType: "reservations", entityId: reservation.id, operation: "update", metadata: { amount: Number(amount) } })
    return { success: true }
  }
  if (kind === "refund-transaction") {
    demandOperation(actor, kind)
    const { transactionId } = z.object({ transactionId: id }).strict().parse(payload)
    const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } })
    if (transaction.type !== "receita" || transaction.originType || /^(Venda|Comanda|Consumo quarto|Hospedagem|Recebimento) /.test(transaction.refId ?? "")) throw new HttpError(409, "Utilize o estorno da operação original")
    if (await tx.transaction.count({ where: { type: "estorno", refId: transaction.id } })) throw new HttpError(409, "Transação já estornada")
    await ledger(tx, actor, transaction.id, transaction.value.abs(), "estorno", transaction.paymentMethod ?? undefined, transaction.accountId ?? undefined,{reversalOfId:transaction.id,originType:"manual-refund",originId:transaction.id})
    await audit(tx, actor, "Receita estornada", transaction.id, { entityType: "transactions", entityId: transaction.id, operation: "update" })
    return { success: true }
  }
  if (kind === "employee-consumption") {
    const input = z.object({ employeeId: id, category: z.enum(["almoco", "jantar", "lanche", "outros"]), paymentType: z.enum(["beneficio", "desconto", "pago"]), items: z.array(z.object({ productId: id, quantity: integer })).min(1).max(100) }).strict().parse(payload)
    const employee = await tx.employee.findUniqueOrThrow({ where: { id: input.employeeId } })
    if (!employee.active) throw new HttpError(409, "Funcionário inativo")
    const items = []
    for (const item of input.items) {
      const product = await tx.pOSProduct.findUniqueOrThrow({ where: { id: item.productId } })
      items.push({ id: randomUUID(), ...item, productName: product.name, unitPrice: product.price, subtotal: product.price.mul(item.quantity) })
    }
    const total = items.reduce((sum, item) => sum.plus(item.subtotal), decimal(0))
    if (input.paymentType === "desconto") {
      const { start, end } = businessMonthBounds()
      const consumed = await tx.employeeConsumption.aggregate({ where: { employeeId: employee.id, paymentType: "desconto", timestamp: { gte: start, lt: end } }, _sum: { total: true } })
      if (total.plus(consumed._sum.total ?? 0).gt(employee.consumptionLimit)) throw new HttpError(409, "Limite mensal excedido")
    }
    if (input.paymentType === "beneficio") {
      const benefit = employee.mealBenefit as Record<string, unknown>
      const key = { almoco: "lunchIncluded", jantar: "dinnerIncluded", lanche: "snackIncluded", outros: "" }[input.category]
      if (!key || !benefit[key]) throw new HttpError(403, "Refeição não incluída no benefício")
    }
    const consumptionId = randomUUID()
    for (const item of items) await moveStock(tx, item.productId, item.quantity, actor, `Consumo funcionário ${consumptionId}`)
    await tx.employeeConsumption.create({ data: { id: consumptionId, employeeId: employee.id, employeeName: employee.name, total, category: input.category, paymentType: input.paymentType, timestamp: new Date(), registeredBy: actor.username, items: { create: items } } })
    if (input.paymentType === "pago") await ledger(tx, actor, consumptionId, total, "receita", "dinheiro")
    await audit(tx, actor, "Consumo de funcionário", consumptionId, { entityType: "employeeConsumptions", entityId: consumptionId, operation: "create" })
    return { success: true }
  }
  if (kind === "production") {
    const input = z.object({ recipeId: id, plannedQuantity: z.number().positive().finite(), producedQuantity: z.number().positive().finite(), notes: z.string().max(2000).optional() }).strict().parse(payload)
    const recipe = await tx.recipe.findUniqueOrThrow({ where: { id: input.recipeId }, include: { ingredients: { include: { product: { include: { category: true } } } } } })
    if (!recipe.active || recipe.expectedYield.lte(0) || !recipe.ingredients.length || recipe.ingredients.some(item => item.quantity.lte(0))) throw new HttpError(409, "Receita inválida ou inativa")
    if (recipe.ingredients.some(item => !item.product.category.isRestaurant) || await tx.stockLot.count({ where: { productId: { in: recipe.ingredients.map(item => item.productId) } } })) throw new HttpError(409, "O módulo arquivado de restaurante não pode consumir o estoque da pousada")
    const productionId = randomUUID(); let totalCost = decimal(0)
    for (const ingredient of [...recipe.ingredients].sort((a, b) => a.productId.localeCompare(b.productId))) {
      const stock = await tx.stockItem.findUniqueOrThrow({ where: { productId: ingredient.productId } })
      let factor: number
      try { factor = unitFactor(ingredient.unit, stock.unit) } catch (error) { throw new HttpError(400, (error as Error).message) }
      const quantity = ingredient.quantity.mul(input.plannedQuantity).mul(factor)
      if (!quantity.equals(quantity.toDecimalPlaces(3))) throw new HttpError(400, "Quantidade exige precisão superior ao estoque (3 casas)")
      const changed = await tx.stockItem.updateMany({ where: { id: stock.id, currentStock: { gte: quantity } }, data: { currentStock: { decrement: quantity } } })
      if (!changed.count) throw new HttpError(409, `Estoque insuficiente: ${ingredient.productName}`)
      totalCost = totalCost.plus(quantity.mul(stock.averageCost))
      await tx.stockMovement.create({ data: { id: randomUUID(), productId: ingredient.productId, productName: ingredient.productName, quantity, type: "saida", unit: stock.unit, cost: stock.averageCost, reason: `Produção ${productionId}`, timestamp: new Date(), registeredBy: actor.username } })
    }
    const result = await tx.production.create({ data: { ...input, id: productionId, recipeName: recipe.name, totalCost: round(totalCost), unitCost: round(totalCost.div(input.producedQuantity)), yield: decimal(input.producedQuantity).div(recipe.expectedYield.mul(input.plannedQuantity)).mul(100), timestamp: new Date(), producedBy: actor.username } })
    await audit(tx, actor, "Produção registrada", productionId, { entityType: "productions", entityId: productionId, operation: "create" })
    return collectionMapper("productions").toApp(result)
  }
  // Corrections of non-operational records are still validated and audited server-side.
  if (kind === "admin-create" || kind === "admin-update") {
    const input = z.object({ key: id, id: id.optional(), data: z.record(z.unknown()) }).strict().parse(payload)
    if (["auditLog", "userSessions", "posSales", "transactions", "stockMovements", "reservations", "cashCloses", "bankTransfers", "restaurantOrders", "consumptions", "productions", "employeeConsumptions"].includes(input.key)) throw new HttpError(403, "Utilize o fluxo específico desta operação")
    demand(actor, `${input.key}.${kind === "admin-create" ? "create" : "edit"}`)
    if (input.key === "users") demand(actor, "users.manage")
    const result = kind === "admin-create" ? await createCollectionItem(input.key, input.data, actor, tx) : await updateCollectionItem(input.key, input.id ?? "", input.data, actor, tx)
    return result
  }
  throw new HttpError(400, "Operação inválida")
}

export async function executeOperation(actor: Actor, requestId: string, kind: string, payload: unknown) {
  const fingerprint = hashToken(JSON.stringify({ kind, payload }))
  const receiptId = hashToken(`${actor.id}:${requestId}`)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        if (actor.permissions) {
          const current = await tx.user.findUnique({ where: { id: actor.id } })
          const session = await tx.authSession.findUnique({ where: { id: actor.sessionId } })
          if (!current?.active || !session || session.expiresAt <= new Date()) throw new HttpError(401, "Sessão expirada")
          actor = { ...actor, permissions: effectivePermissions(current), permissionOverrides: current.permissionOverrides as Actor["permissionOverrides"] }
        }
        const receipt = await tx.operationReceipt.findUnique({ where: { id: receiptId } })
        if (receipt) {
          if (receipt.requestHash !== fingerprint) throw new HttpError(409, "Identificador reutilizado com dados diferentes")
          // A completed approval permits only retrieving this receipt; explicit
          // denials and current access to the underlying action still apply.
          demandOperation({ ...actor, grantedPermissions: DELEGATABLE }, kind)
          if (kind === "admin-create" || kind === "admin-update") {
            const input = z.object({ key: id }).passthrough().parse(payload)
            demand(actor, `${input.key}.${kind === "admin-create" ? "create" : "edit"}`)
            demand(actor, `${input.key}.read`)
            if (input.key === "users") demand(actor, "users.manage")
          }
          return receipt.result
        }
        const grants = await tx.operationApproval.findMany({ where: { sessionId: actor.sessionId, requesterId: actor.id, requestId, requestHash: fingerprint, usedAt: null, expiresAt: { gt: new Date() } } })
        const valid = []
        for (const grant of grants) {
          const approver = await tx.user.findUnique({ where: { id: grant.approverId } })
          if (grant.resourceHash === await approvalResourceHash(tx, kind, payload) && approver?.active && approver.accessVersion === grant.approverVersion && effectivePermissions(approver).includes("approvals.issue") && effectivePermissions(approver).includes(grant.permission)) valid.push(grant)
        }
        const scopedActor = { ...actor, grantedPermissions: valid.map(grant => grant.permission) }
        let result: Prisma.InputJsonValue
        try { result = JSON.parse(JSON.stringify(await applyOperation(tx, scopedActor, kind, payload))) as Prisma.InputJsonValue }
        catch (error) {
          if (error instanceof HttpError && error.details?.approvalRequired) error.details = { ...error.details, ...await approvalReview(tx, actor, kind, payload) }
          throw error
        }
        await emitOperation(tx, actor, requestId, kind, payload, result)
        // Avoid scanning unrelated modules while a user's transaction holds locks.
        // The existing worker still performs a full reconciliation every 30 seconds.
        if (["sale", "cancel-sale", "close-order", "stock-movement", "employee-consumption", "production", "add-consumption", "remove-consumption"].includes(kind) || operationIsInventory(kind)) { await evaluateStock(tx); if(operationIsInventory(kind))await evaluateTimed(tx) }
        if (["reserve", "reserve-group", "edit-reservation", "check-in", "check-out", "pay-reservation", "cancel-reservation", "reservation-discount", "open-table", "edit-order", "close-order", "cancel-order", "receive-account", "receive-batch", "stay-checkout", "stay-receive", "stay-transfer"].includes(kind) || (["admin-create", "admin-update"].includes(kind) && ["accountsReceivable", "systemSettings"].includes((payload as { key?: string }).key ?? ""))) await evaluateTimed(tx)
        for (const grant of valid) {
          await tx.operationApproval.update({ where: { id: grant.id }, data: { usedAt: new Date() } })
          await audit(tx, actor, "Operação aprovada", kind, { entityType: "operationApprovals", entityId: requestId, operation: "action", metadata: { approverId: grant.approverId, executorId: actor.id, permission: grant.permission } })
        }
        await tx.operationReceipt.create({ data: { id: receiptId, userId: actor.id, requestHash: fingerprint, result } })
        return result
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
    } catch (error) {
      const code = (error as { code?: string }).code
      if (attempt < 2 && code === "P2034") { logEvent("info", "concurrency.retry", {}, error); await retryDelay(attempt); continue }
      if (code === "P2002") {
        const receipt = await prisma.operationReceipt.findUnique({ where: { id: receiptId } })
        if (receipt && receipt.requestHash === fingerprint && attempt < 2) continue
      }
      throw error
    }
  }
  throw new HttpError(409, "Operação concorrente")
}
