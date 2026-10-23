import type { DataStore } from "./types"
import type { ConsumptionItem } from "@/lib/store"
import { withDemoTransaction } from "./demo-transaction"
import { touchDemoCash } from "./demo-cash-session"
import { demoLedger } from "./demo-ledger"
import { stayBalance } from "@/lib/stays"
import { distributePayment, type PaymentLine } from "@/lib/payments"
import { z } from "zod"

export function demoAddConsumption(store: DataStore, roomId: number, item: ConsumptionItem, expectedStayId: string | undefined, can: (permission: string) => boolean, username: string) {
  return withDemoTransaction(store, async staged => {
    if (!can("consumptions.create")) throw Error("Você não tem permissão para lançar consumo")
    const stay = (await staged.stays.getAll()).find(s => s.roomId === roomId && s.status === "active")
    if (!stay || stay.id !== expectedStayId) throw Error("Reabra o consumo para conferir a hospedagem atual")
    if (stay.charges.some(c => c.id === item.id)) return
    const turn = await touchDemoCash(staged, true)
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || Math.abs(item.unitPrice * 100 - Math.round(item.unitPrice * 100)) > .00001) throw Error("Confira a quantidade e o valor")
    const product = (await staged.posProducts.getAll()).find(p => item.productId ? p.id === item.productId : p.name === item.label)
    if (item.productId && !product || product?.active === false) throw Error("Bebida indisponível")
    if (!product && !can("consumptions.custom")) throw Error("Você não tem permissão para consumo manual")
    const now = new Date().toISOString(), delivered = { ...item, unitPrice: product?.price ?? item.unitPrice, label: product?.name ?? item.label }
    if (product?.trackStock) {
      const stock = (await staged.stockItems.getAll()).find(s => s.productId === product.id)
      if (!stock || stock.currentStock < item.quantity) throw Error("Estoque insuficiente")
      await staged.stockItems.update(stock.id, { currentStock: stock.currentStock - item.quantity })
      await staged.stockMovements.create({ type: "saida", productId: product.id, productName: product.name, quantity: item.quantity, unit: stock.unit, reason: `Consumo ${item.id}`, timestamp: now, registeredBy: username })
    }
    await staged.stays.update(stay.id, { recordVersion: stay.recordVersion + 1, charges: [...stay.charges, { ...delivered, operationalSessionId: turn!.id, status: "active", createdAt: now }] })
    const projection = await staged.consumptions.getByRoomId(roomId)
    if (projection) await staged.consumptions.update(roomId, { items: [...projection.items, delivered] })
    else await staged.consumptions.create({ roomId, items: [delivered] })
    await staged.auditLog.create({ date: now, user: username, action: "Consumo lançado", reference: item.id, entityType: "consumptions", entityId: item.id, operation: "create" })
  })
}

export function demoPayConsumption(store: DataStore, payload: unknown, can: (permission: string) => boolean, username: string, requestId: string) {
  return withDemoTransaction(store, async staged => {
    if (!can("consumptions.receive")) throw Error("Você não tem permissão para receber consumo")
    const input = z.object({ roomId: z.number().int().positive(), expectedStayId: z.string(), recordVersion: z.number().int().nonnegative(), paymentMethod: z.string(), accountId: z.string().optional(), payments: z.array(z.object({ method: z.string(), value: z.number(), accountId: z.string().optional() })).optional() }).strict().parse(payload)
    const previous = (await staged.auditLog.getAll()).find(a => a.action === "Consumo quitado" && a.metadata?.requestId === requestId)
    if (previous) {
      if (JSON.stringify(previous.metadata?.payload) !== JSON.stringify(payload)) throw Error("Confirmação reutilizada com dados diferentes")
      return { success: true }
    }
    const stay = await staged.stays.getById(input.expectedStayId)
    if (!stay || stay.status !== "active" || stay.roomId !== input.roomId || stay.recordVersion !== input.recordVersion) throw Error("Hospedagem alterada; reabra o consumo para conferir")
    const total = stayBalance(stay).consumptionBalance
    if (total <= 0) throw Error("Consumo já quitado")
    const plan = distributePayment(total, input.payments ?? [{ method: input.paymentMethod, value: total, accountId: input.accountId }] as PaymentLine[])
    const now = new Date().toISOString(), payments = [...stay.payments]
    for (const line of plan.lines) if (line.applied > 0) {
      const entry = await demoLedger(staged, { date: now, description: `Consumo quarto ${input.roomId}`, refId: `Consumo quarto ${input.roomId}`, originType: "stay-consumption", originId: stay.id, type: "receita", value: line.applied, paymentMethod: line.method, accountId: line.accountId, responsible: username })
      payments.push({ id: crypto.randomUUID(), value: line.applied, bucket: "consumption", method: line.method, transactionId: entry.id, createdAt: now })
    }
    await staged.stays.update(stay.id, { payments, recordVersion: stay.recordVersion + 1 })
    await staged.consumptions.clearByRoomId(input.roomId)
    await staged.auditLog.create({ date: now, user: username, action: "Consumo quitado", reference: stay.id, entityType: "stays", entityId: stay.id, operation: "action", metadata: { requestId, payload } })
    return { success: true }
  })
}
