import { lotUsable } from '@/lib/inventory'
import { Prisma } from "@prisma/client"
import { randomUUID } from "node:crypto"
import { emitEvent, type EventInput } from "./service"
import { ruleSchema } from "@/lib/notification-policy"
import { businessDay, BUSINESS_TIME_ZONE } from "@/lib/utils/business-values"
type Tx = Prisma.TransactionClient
async function condition(tx: Tx, key: string, input: Omit<EventInput, "dedupKey" | "conditionKey"> | null) {
  const existing = await tx.notificationEvent.findUnique({ where: { conditionKey: key } })
  if (!input) {
    if (existing) await tx.notificationEvent.update({ where: { id: existing.id }, data: { conditionKey: null, resolvedAt: new Date() } })
    return
  }
  if (existing?.priority === (input.priority ?? "medium")) return
  if (existing) await tx.notificationEvent.update({ where: { id: existing.id }, data: { conditionKey: null, resolvedAt: new Date() } })
  await emitEvent(tx, { ...input, dedupKey: randomUUID(), conditionKey: key })
}
export async function evaluateStock(tx: Tx) {
  const settings = await tx.systemSettings.findFirst()
  const rules = ruleSchema.parse(settings?.notificationRules ?? {})
  const stocks = await tx.stockItem.findMany({ include: { product: { include: { category: true, lots: true } } } })
  const keys: string[] = []
  for (const stock of stocks) {
    if (stock.product.category?.isRestaurant) continue
    const key = `stock:${stock.productId}`; keys.push(key)
    const usable=stock.product.lots.filter(l=>lotUsable({status:l.status,expiresAt:l.expiresAt?.toISOString()??null},businessDay(),stock.product.requiresExpiry)).reduce((sum,l)=>sum+Number(l.quantity),0)
    const ratio = Number(stock.minimumStock) > 0 ? usable / Number(stock.minimumStock) * 100 : Infinity
    const priority = ratio <= rules.stockCriticalLevel ? "critical" : ratio <= rules.stockLowLevel ? "high" : null
    await condition(tx, key, settings?.notifyLowStock !== false && stock.product.trackStock && priority ? {
      type: "stock", title: priority === "critical" ? "Estoque crítico" : "Estoque baixo", message: `${stock.productName}: confira o saldo e programe a reposição.`,
      module: "estoque", reference: stock.productId, priority, requiredPermissions: ["stockItems.read"] } : null)
  }
  await resolveMissing(tx, "stock:", keys)
}
async function resolveMissing(tx: Tx, prefix: string, keys: string[]) {
  await tx.notificationEvent.updateMany({ where: { conditionKey: { startsWith: prefix, notIn: keys } }, data: { conditionKey: null, resolvedAt: new Date() } })
}
export async function evaluateTimed(tx: Tx, now = new Date()) {
  const settings = await tx.systemSettings.findFirst()
  const today = businessDay(now)
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now)
  const expiryKeys:string[]=[]
  const expiryLimit=new Date(Date.parse(today)+7*86400000).toISOString().slice(0,10)
  const lots=await tx.stockLot.findMany({where:{quantity:{gt:0},product:{category:{isRestaurant:false}}},include:{product:true}})
  for(const lot of lots){const key=`expiry:${lot.id}`;expiryKeys.push(key);const date=lot.expiresAt?.toISOString().slice(0,10),expired=!!date&&date<today,review=lot.status==='unverified'||(lot.product.requiresExpiry&&!date),soon=!!date&&date<=expiryLimit
    await condition(tx,key,expired||review||soon?{type:'stock',title:expired?'Lote vencido':review?'Abertura de estoque pendente':'Lote próximo do vencimento',message:`${lot.product.name} · lote ${lot.code}: ${review?'revise identificação e validade':expired?'saldo físico bloqueado para venda':'vence em '+date}.`,module:'estoque',reference:lot.id,priority:expired?'critical':'high',requiredPermissions:['stockLots.read']}:null)
  }
  await resolveMissing(tx,'expiry:',expiryKeys)
  const reservations = await tx.reservation.findMany({ where: { status: { in: ["confirmada", "checkin"] } } })
  const keys: string[] = []
  for (const reservation of reservations) {
    const start = reservation.checkIn.toISOString().slice(0, 10); const end = reservation.checkOut.toISOString().slice(0, 10)
    const incoming = reservation.status === "confirmada" && start === today && hour >= (settings?.checkInTime ?? "14:00") && settings?.notifyCheckInReminder !== false
    const departureDue = reservation.status === "checkin" && end <= today && (end < today || hour >= (settings?.checkOutTime ?? "12:00"))
    const outgoing = departureDue && settings?.notifyCheckOutReminder !== false
    for (const [name, active, title, type] of [
      ["arrival", incoming, "Entrada prevista", "check-in"], ["departure", outgoing, "Saída prevista", "check-out"],
      ["payment", departureDue && reservation.paidValue.lt(reservation.totalValue) && settings?.notifyPendingPayments !== false, "Saldo de hospedagem pendente", "payment"],
    ] as const) {
      const key = `${name}:${reservation.id}:${today}`; keys.push(key)
      await condition(tx, key, active ? { type, title, message: `Quarto ${reservation.roomNumber}: consulte a reserva.`, module: "reservas", reference: reservation.id,
        requiredPermissions: type === "payment" ? ["reservations.read", "transactions.read"] : ["reservations.read"] } : null)
    }
  }
  for (const prefix of ["arrival:", "departure:", "payment:"]) await resolveMissing(tx, prefix, keys)
  const receivables = await tx.accountReceivable.findMany({ where: { status: { not: "pago" } }, include: { installments: true } })
  const paymentKeys: string[] = []
  for (const account of receivables) {
    const overdue = account.installments.length ? account.installments.some(part => part.status !== "pago" && part.dueDate.toISOString().slice(0, 10) < today) : account.dueDate.toISOString().slice(0, 10) < today
    const key = `receivable:${account.id}`; paymentKeys.push(key)
    await condition(tx, key, overdue && settings?.notifyPendingPayments !== false && account.status !== "cancelado" ? { type: "payment", title: "Recebimento vencido", message: "Há um título vencido. Confira as contas a receber.", module: "financeiro", reference: account.id, requiredPermissions: ["accountsReceivable.read"], priority: "high" } : null)
  }
  await resolveMissing(tx, "receivable:", paymentKeys)
}
