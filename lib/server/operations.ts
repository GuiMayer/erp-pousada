import { approvalResourceHash, approvalReview } from "./approval-scope"
import { effectivePermissions } from "@/lib/permissions"
import { demand, demandOperation } from "./permissions"
import { financeOperation, recordLedger, paymentFields } from "./business-finance"
import { normalizePayment } from "../utils/business-values"
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
const saleInput = z.object({ sale: z.object({ id, items: z.array(cartItem).min(1).max(100), total: money, paymentMethod: payment, accountId: id.optional(), amountPaid: money, customer: z.string().max(200).optional() }).passthrough(), globalDiscount: percent })
const checkinInput = z.object({ roomId: integer, cpf, guestName: text, checkIn: z.string().date(), checkOut: z.string().date(), totalValue: money }).strict()
const decimal = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n)
const round = (n: Prisma.Decimal) => n.toDecimalPlaces(2)
type Tx = Prisma.TransactionClient

async function audit(tx: Tx, actor: Actor, action: string, reference: string) {
  await tx.auditEntry.create({ data: { id: randomUUID(), user: actor.username, action, reference } })
}
async function checkDiscount(tx: Tx, actor: Actor, value: number) {
  const settings = await tx.systemSettings.findFirst()
  if (value - (settings?.discountCeiling ?? 0) > 0.000001) demand(actor, "discount.override")
}
async function moveStock(tx: Tx, productId: string, quantity: number, actor: Actor, reference: string, restore = false) {
  const product = await tx.pOSProduct.findUniqueOrThrow({ where: { id: productId } })
  if (!product.trackStock) return
  const stock = await tx.stockItem.findUnique({ where: { productId } })
  if (!stock) throw new HttpError(409, "Produto sem estoque cadastrado")
  const changed = await tx.stockItem.updateMany({ where: { id: stock.id, ...(restore ? {} : { currentStock: { gte: quantity } }) }, data: { currentStock: restore ? { increment: quantity } : { decrement: quantity } } })
  if (changed.count !== 1) throw new HttpError(409, `Estoque insuficiente: ${product.name}`)
  await tx.stockMovement.create({ data: { id: randomUUID(), type: restore ? "entrada" : "saida", productId, productName: product.name, quantity, unit: stock.unit, cost: stock.averageCost, reason: reference, timestamp: new Date(), registeredBy: actor.username } })
}
const ledger = recordLedger

async function assertRoomPeriod(tx: Tx, room: { id: number; status: string; blockEndDate: Date | null }, start: Date, end: Date) {
  if (end <= start) throw new HttpError(400, "Período inválido")
  if (room.status === "bloqueado" && (!room.blockEndDate || start <= room.blockEndDate)) throw new HttpError(409, "Período coincide com bloqueio do quarto")
}

export async function applyOperation(tx: Tx, actor: Actor, kind: string, payload: unknown): Promise<unknown> {
  demandOperation(actor, kind)
  const financeResult = await financeOperation(tx, actor, kind, payload)
  if (financeResult !== undefined) return financeResult
  if (kind === "reserve-group") {
    const input = z.object({ rooms: z.array(z.object({ roomId: integer, totalValue: money })).min(1).max(50), cpf, guestName: text, checkIn: z.string().date(), checkOut: z.string().date() }).strict().parse(payload)
    if (new Set(input.rooms.map(room => room.roomId)).size !== input.rooms.length) throw new HttpError(400, "Quartos repetidos")
    const results = []
    for (const room of input.rooms) results.push(await applyOperation(tx, actor, "reserve", { ...room, cpf: input.cpf, guestName: input.guestName, checkIn: input.checkIn, checkOut: input.checkOut }))
    return results
  }
  if (kind === "sale") {
    const { sale, globalDiscount } = saleInput.parse(payload)
    await checkDiscount(tx, actor, Math.max(...sale.items.map(i => 100 * (1 - (1 - i.discount / 100) * (1 - globalDiscount / 100)))))
    const products = await tx.pOSProduct.findMany({ where: { id: { in: sale.items.map(i => i.product.id) } } })
    let subtotal = decimal(0)
    const items = sale.items.map(item => {
      const product = products.find(p => p.id === item.product.id)
      if (!product) throw new HttpError(404, "Produto não encontrado")
      const itemSubtotal = round(product.price.mul(item.quantity).mul(decimal(1).minus(decimal(item.discount).div(100))))
      subtotal = subtotal.plus(itemSubtotal)
      return { id: item.id, productId: product.id, quantity: item.quantity, discount: item.discount, unitPrice: product.price, subtotal: itemSubtotal }
    })
    const discount = round(subtotal.mul(globalDiscount).div(100))
    const total = round(subtotal.minus(discount))
    if (!total.equals(round(decimal(sale.total)))) throw new HttpError(409, "Preço alterado. Atualize o carrinho.")
    if (decimal(sale.amountPaid).lt(total)) throw new HttpError(400, "Pagamento insuficiente")
    for (const item of items) await moveStock(tx, item.productId, item.quantity, actor, `Venda ${sale.id}`)
    const result = await tx.pOSSale.create({ data: { id: sale.id, date: new Date(), subtotal, discount, total, paymentMethod: normalizePayment(sale.paymentMethod), amountPaid: sale.amountPaid, change: sale.paymentMethod.toLowerCase() === "dinheiro" ? decimal(sale.amountPaid).minus(total) : 0, customer: sale.customer, operator: actor.username, status: "concluida", items: { create: items } }, include: { items: { include: { product: true } } } })
    await ledger(tx, actor, `Venda ${sale.id}`, total, "receita", sale.paymentMethod, sale.accountId)
    await audit(tx, actor, "Venda finalizada", sale.id)
    return collectionMapper("posSales").toApp(result)
  }
  if (kind === "cancel-sale") {
    demandOperation(actor, kind)
    const input = z.object({ saleId: id, reason: text, returnToStock: z.boolean() }).strict().parse(payload)
    const sale = await tx.pOSSale.findUniqueOrThrow({ where: { id: input.saleId }, include: { items: true } })
    if (sale.status !== "concluida") throw new HttpError(409, "Venda já estornada")
    if (input.returnToStock) for (const item of sale.items) await moveStock(tx, item.productId, item.quantity, actor, `Estorno ${sale.id}`, true)
    await tx.pOSSale.update({ where: { id: sale.id }, data: { status: "cancelada", cancelReason: input.reason } })
    const originalPayment = await tx.transaction.findFirstOrThrow({ where: { refId: `Venda ${sale.id}`, type: "receita" } })
    await ledger(tx, actor, `Estorno ${sale.id}`, sale.total, "estorno", sale.paymentMethod, originalPayment.accountId ?? undefined)
    await audit(tx, actor, "Venda estornada", `${sale.id}: ${input.reason}`)
    return { success: true }
  }
  if (kind === "reserve" || kind === "edit-reservation") {
    const input = z.object({ id: id.optional(), roomId: integer, cpf, guestName: text, checkIn: z.string().date(), checkOut: z.string().date(), totalValue: money, status: z.enum(["confirmada", "cancelada", "noshow"]).default("confirmada"), cancelTreatment: z.string().max(200).optional(), recordVersion: z.number().int().nonnegative().optional() }).strict().parse(payload)
    const checkIn = new Date(input.checkIn), checkOut = new Date(input.checkOut)
    if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) || checkOut <= checkIn) throw new HttpError(400, "Período inválido")
    const room = await tx.room.findUniqueOrThrow({ where: { id: input.roomId } })
    let originalValue = decimal(input.totalValue)
    if (kind === "edit-reservation") {
      const current = await tx.reservation.findUniqueOrThrow({ where: { id: input.id } })
      if (input.recordVersion !== current.recordVersion) throw new HttpError(409, "Reserva alterada por outro usuário. Reabra o formulário.")
      originalValue = Prisma.Decimal.max(current.originalValue ?? current.totalValue, current.totalValue, input.totalValue)
      if (current.status !== "confirmada") throw new HttpError(409, "Somente reserva confirmada pode ser editada")
      if (current.paidValue.gt(0) && current.cpf !== input.cpf) throw new HttpError(409, "Reserva paga não permite trocar o titular")
      if (input.totalValue < Number(current.totalValue)) await checkDiscount(tx, actor, Number((current.originalValue ?? current.totalValue).minus(input.totalValue).div(current.originalValue ?? current.totalValue).mul(100)))
      if (current.paidValue.gt(input.totalValue)) throw new HttpError(409, "Valor inferior ao recebido; faça a conciliação antes")
    }
    if (input.status !== "confirmada") throw new HttpError(400, "Utilize o fluxo de cancelamento ou no-show")
    await assertRoomPeriod(tx, room, checkIn, checkOut)
    if (input.status === "confirmada") {
      const overlap = await tx.reservation.count({ where: { ...(kind === "edit-reservation" ? { id: { not: input.id } } : {}), roomId: room.id, status: { in: ["confirmada", "checkin"] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } } })
      if (overlap) throw new HttpError(409, "Reserva conflita com outra hospedagem")
    }
    await tx.guestProfile.upsert({ where: { cpf: input.cpf }, create: { cpf: input.cpf, name: input.guestName }, update: { name: input.guestName } })
    const { recordVersion: _version, ...fields } = input
    const data = { ...fields, id: input.id || randomUUID(), checkIn, checkOut, roomNumber: room.number, originalValue }
    const result = kind === "reserve" ? await tx.reservation.create({ data }) : await tx.reservation.update({ where: { id: input.id }, data: { ...data, recordVersion: { increment: 1 } } })
    await audit(tx, actor, kind === "reserve" ? "Reserva criada" : "Reserva alterada", result.id)
    return collectionMapper("reservations").toApp(result)
  }
  if (kind === "check-in") {
    const input = checkinInput.parse(payload)
    const checkIn = new Date(input.checkIn), checkOut = new Date(input.checkOut)
    if (checkOut <= checkIn) throw new HttpError(400, "Período inválido")
    const room = await tx.room.findUniqueOrThrow({ where: { id: input.roomId } })
    if (room.status !== "disponivel") throw new HttpError(409, "Quarto indisponível")
    await assertRoomPeriod(tx, room, checkIn, checkOut)
    const existing = await tx.reservation.findFirst({ where: { roomId: room.id, cpf: input.cpf, status: "confirmada", checkIn: new Date(input.checkIn), checkOut: new Date(input.checkOut) } })
    if (existing && !existing.totalValue.equals(input.totalValue)) throw new HttpError(409, "Use o valor confirmado da reserva ou edite-a antes do check-in")
    const overlap = await tx.reservation.count({ where: { ...(existing ? { id: { not: existing.id } } : {}), roomId: room.id, status: { in: ["confirmada", "checkin"] }, checkIn: { lt: new Date(input.checkOut) }, checkOut: { gt: new Date(input.checkIn) } } })
    if (overlap) throw new HttpError(409, "Reserva conflita com outra hospedagem")
    await tx.guestProfile.upsert({ where: { cpf: input.cpf }, create: { cpf: input.cpf, name: input.guestName, totalStays: 1 }, update: { name: input.guestName, totalStays: { increment: 1 } } })
    await tx.room.update({ where: { id: room.id }, data: { status: "ocupado", guest: input.guestName, guestCpf: input.cpf, checkIn: new Date(input.checkIn), checkOut: new Date(input.checkOut) } })
    const reservation = existing ? await tx.reservation.update({ where: { id: existing.id }, data: { status: "checkin" } }) : await tx.reservation.create({ data: { id: randomUUID(), roomId: room.id, roomNumber: room.number, guestName: input.guestName, cpf: input.cpf, checkIn: new Date(input.checkIn), checkOut: new Date(input.checkOut), status: "checkin", totalValue: input.totalValue, originalValue: input.totalValue } })
    await audit(tx, actor, "Check-in realizado", `${room.number}: ${reservation.id}`)
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
      const stay = await tx.reservation.findFirstOrThrow({ where: { roomId, status: "checkin" } })
      if (stay.paidValue.lt(stay.totalValue)) throw new HttpError(409, "Quite a hospedagem antes do check-out")
      const consumption = await tx.roomConsumption.findUnique({ where: { roomId }, include: { items: true } })
      if (consumption?.items.some(i => i.unitPrice.mul(i.quantity).gt(0))) throw new HttpError(409, "Quite o consumo antes do check-out")
      await tx.roomConsumption.deleteMany({ where: { roomId } })
      await tx.room.update({ where: { id: roomId }, data: { status: "limpeza", guest: null, guestCpf: null, checkIn: null, checkOut: null } })
      await tx.reservation.updateMany({ where: { roomId, status: "checkin" }, data: { status: "checkout" } })
    }
    await audit(tx, actor, kind === "release-room" ? "Quarto liberado" : "Check-out realizado", room.number)
    return { success: true }
  }
  if (kind === "add-consumption") {
    const { roomId, item } = z.object({ roomId: integer, item: z.object({ id, label: text, unitPrice: money, quantity: integer }) }).strict().parse(payload)
    const room = await tx.room.findUniqueOrThrow({ where: { id: roomId } })
    if (room.status !== "ocupado") throw new HttpError(409, "Quarto não está ocupado")
    const product = await tx.pOSProduct.findFirst({ where: { name: item.label } })
    if (product) item.unitPrice = Number(product.price)
    else demand(actor, "consumptions.custom")
    if (product) await moveStock(tx, product.id, item.quantity, actor, `Consumo quarto ${room.number}`)
    const consumption = await tx.roomConsumption.upsert({ where: { roomId }, create: { id: randomUUID(), roomId }, update: {} })
    await tx.roomConsumptionItem.create({ data: { ...item, consumptionId: consumption.id } })
    await audit(tx, actor, "Consumo lançado", `${room.number}: ${item.label}`)
    return { success: true }
  }
  if (kind === "remove-consumption") {
    demandOperation(actor, kind)
    const input = z.object({ roomId: integer, itemId: id }).strict().parse(payload)
    const item = await tx.roomConsumptionItem.findUniqueOrThrow({ where: { id: input.itemId }, include: { consumption: true } })
    if (item.consumption.roomId !== input.roomId) throw new HttpError(404, "Item não encontrado")
    // Removal is a billing correction; consumed goods are not returned to inventory.
    await tx.roomConsumptionItem.delete({ where: { id: item.id } })
    await audit(tx, actor, "Consumo removido", `${input.roomId}: ${item.label}`)
    return { success: true }
  }
  if (kind === "pay-consumption") {
    const { roomId, paymentMethod, accountId } = z.object({ roomId: integer, ...paymentFields }).strict().parse(payload)
    const consumption = await tx.roomConsumption.findUniqueOrThrow({ where: { roomId }, include: { items: true } })
    const total = consumption.items.reduce((sum, item) => sum.plus(item.unitPrice.mul(item.quantity)), decimal(0))
    if (total.lte(0)) throw new HttpError(409, "Consumo já quitado")
    await ledger(tx, actor, `Consumo quarto ${roomId}`, total, "receita", paymentMethod, accountId)
    await tx.roomConsumption.delete({ where: { id: consumption.id } })
    await audit(tx, actor, "Consumo quitado", String(roomId))
    return { success: true }
  }
  if (kind === "open-table") {
    const { tableId, orderId } = z.object({ tableId: integer, orderId: id }).strict().parse(payload)
    const table = await tx.restaurantTable.findUniqueOrThrow({ where: { id: tableId } })
    if (table.status === "ocupada") throw new HttpError(409, "Mesa ocupada")
    const order = await tx.restaurantOrder.create({ data: { id: orderId, tableId, tableNumber: table.number, subtotal: 0, discount: 0, total: 0, status: "aberta", openedAt: new Date(), operator: actor.username }, include: { items: true } })
    await tx.restaurantTable.update({ where: { id: tableId }, data: { status: "ocupada", currentOrderId: orderId, openedAt: new Date() } })
    await audit(tx, actor, "Mesa aberta", table.number)
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
    await audit(tx, actor, kind === "close-order" ? "Comanda fechada" : "Comanda cancelada", order.id)
    return { success: true }
  }
  if (kind === "table-status") {
    const input = z.object({ tableId: integer, status: z.enum(["livre", "reservada"]) }).strict().parse(payload)
    const table = await tx.restaurantTable.findUniqueOrThrow({ where: { id: input.tableId } })
    if (table.status === "ocupada") throw new HttpError(409, "Encerre a comanda primeiro")
    await tx.restaurantTable.update({ where: { id: input.tableId }, data: { status: input.status } })
    return { success: true }
  }
  if (kind === "stock-movement") {
    const input = z.object({ productId: id, type: z.enum(["entrada", "saida", "ajuste", "perda"]), quantity: z.number().finite().nonnegative().max(999999), reason: text, cost: money.optional(), invoiceNumber: z.string().max(200).optional(), expirationDate: z.string().optional(), notes: z.string().max(2000).optional() }).strict().parse(payload)
    const stock = await tx.stockItem.findUniqueOrThrow({ where: { productId: input.productId } })
    const next = input.type === "entrada" ? stock.currentStock.plus(input.quantity) : input.type === "ajuste" ? decimal(input.quantity) : stock.currentStock.minus(input.quantity)
    if (next.lt(0)) throw new HttpError(409, "Estoque insuficiente")
    const averageCost = input.type === "entrada" && input.cost !== undefined && next.gt(0) ? stock.currentStock.mul(stock.averageCost).plus(decimal(input.quantity).mul(input.cost)).div(next) : stock.averageCost
    await tx.stockItem.update({ where: { id: stock.id }, data: { currentStock: next, averageCost, ...(input.type === "entrada" ? { lastPurchaseDate: new Date(), lastPurchasePrice: input.cost ?? stock.lastPurchasePrice } : {}) } })
    const movement = await tx.stockMovement.create({ data: { ...input, id: randomUUID(), productName: stock.productName, unit: stock.unit, timestamp: new Date(), expirationDate: input.expirationDate ? new Date(input.expirationDate) : undefined, registeredBy: actor.username } })
    await audit(tx, actor, "Movimento de estoque", movement.id)
    return collectionMapper("stockMovements").toApp(movement)
  }
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
    await audit(tx, actor, "Desconto em reserva", `${reservation.id}: ${amount}`)
    return { success: true }
  }
  if (kind === "pay-expense") {
    const input = z.object({ expenseId: id, installmentId: id.optional(), ...paymentFields }).strict().parse(payload)
    const expense = await tx.expense.findUniqueOrThrow({ where: { id: input.expenseId }, include: { installments: true } })
    let value = expense.value
    let reference = expense.id
    if (input.installmentId) {
      const installment = expense.installments.find(i => i.id === input.installmentId)
      if (!installment) throw new HttpError(404, "Parcela não encontrada")
      if (installment.paid) throw new HttpError(409, "Parcela já paga")
      value = installment.value; reference = installment.id
      await tx.expenseInstallment.update({ where: { id: installment.id }, data: { paid: true, paymentDate: new Date() } })
      if (expense.installments.every(i => i.id === installment.id || i.paid)) await tx.expense.update({ where: { id: expense.id }, data: { paid: true, paymentDate: new Date() } })
    } else {
      if (expense.paid || expense.installments.length) throw new HttpError(409, "Despesa já paga ou parcelada")
      await tx.expense.update({ where: { id: expense.id }, data: { paid: true, paymentDate: new Date() } })
    }
    await ledger(tx, actor, reference, value, "despesa", input.paymentMethod, input.accountId)
    await audit(tx, actor, "Despesa paga", reference)
    return { success: true }
  }
  if (kind === "refund-transaction") {
    demandOperation(actor, kind)
    const { transactionId } = z.object({ transactionId: id }).strict().parse(payload)
    const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } })
    if (transaction.type !== "receita" || /^(Venda|Comanda|Consumo quarto|Hospedagem|Recebimento) /.test(transaction.refId ?? "")) throw new HttpError(409, "Utilize o estorno da operação original")
    if (await tx.transaction.count({ where: { type: "estorno", refId: transaction.id } })) throw new HttpError(409, "Transação já estornada")
    await ledger(tx, actor, transaction.id, transaction.value.abs(), "estorno", transaction.paymentMethod ?? undefined, transaction.accountId ?? undefined)
    await audit(tx, actor, "Receita estornada", transaction.id)
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
      const now = new Date()
      const consumed = await tx.employeeConsumption.aggregate({ where: { employeeId: employee.id, paymentType: "desconto", timestamp: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) } }, _sum: { total: true } })
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
    await audit(tx, actor, "Consumo de funcionário", consumptionId)
    return { success: true }
  }
  if (kind === "production") {
    const input = z.object({ recipeId: id, plannedQuantity: z.number().positive().finite(), producedQuantity: z.number().positive().finite(), notes: z.string().max(2000).optional() }).strict().parse(payload)
    const recipe = await tx.recipe.findUniqueOrThrow({ where: { id: input.recipeId }, include: { ingredients: true } })
    if (!recipe.active || recipe.expectedYield.lte(0) || !recipe.ingredients.length || recipe.ingredients.some(item => item.quantity.lte(0))) throw new HttpError(409, "Receita inválida ou inativa")
    const productionId = randomUUID(); let totalCost = decimal(0)
    for (const ingredient of recipe.ingredients) {
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
    await audit(tx, actor, "Produção registrada", productionId)
    return collectionMapper("productions").toApp(result)
  }
  // Corrections of non-operational records are still validated and audited server-side.
  if (kind === "admin-create" || kind === "admin-update") {
    const input = z.object({ key: id, id: id.optional(), data: z.record(z.unknown()) }).strict().parse(payload)
    if (["auditLog", "userSessions", "posSales", "transactions", "stockMovements", "reservations", "cashCloses", "bankTransfers", "restaurantOrders", "consumptions", "productions", "employeeConsumptions"].includes(input.key)) throw new HttpError(403, "Utilize o fluxo específico desta operação")
    demand(actor, `${input.key}.${kind === "admin-create" ? "create" : "edit"}`)
    if (input.key === "users") demand(actor, "users.manage")
    const result = kind === "admin-create" ? await createCollectionItem(input.key, input.data, actor, tx) : await updateCollectionItem(input.key, input.id ?? "", input.data, actor, tx)
    await audit(tx, actor, kind, input.key)
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
        const receipt = await tx.operationReceipt.findUnique({ where: { id: receiptId } })
        if (receipt) {
          if (receipt.requestHash !== fingerprint) throw new HttpError(409, "Identificador reutilizado com dados diferentes")
          return receipt.result
        }
        if (actor.permissions) {
          const current = await tx.user.findUnique({ where: { id: actor.id } })
          const session = await tx.authSession.findUnique({ where: { id: actor.sessionId } })
          if (!current?.active || !session || session.expiresAt <= new Date()) throw new HttpError(401, "Sessão expirada")
          actor = { ...actor, permissions: effectivePermissions(current), permissionOverrides: current.permissionOverrides as Actor["permissionOverrides"] }
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
        for (const grant of valid) {
          await tx.operationApproval.update({ where: { id: grant.id }, data: { usedAt: new Date() } })
          await tx.auditEntry.create({ data: { id: randomUUID(), user: actor.username, action: "Operação aprovada", reference: kind, entityId: requestId, metadata: { approverId: grant.approverId, executorId: actor.id, permission: grant.permission } } })
        }
        await tx.operationReceipt.create({ data: { id: receiptId, userId: actor.id, requestHash: fingerprint, result } })
        return result
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
    } catch (error) {
      const code = (error as { code?: string }).code
      if (attempt < 2 && ["P2034", "P2002"].includes(code ?? "")) continue
      throw error
    }
  }
  throw new HttpError(409, "Operação concorrente")
}
