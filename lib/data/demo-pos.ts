import { z } from "zod"
import type { DataStore } from "./types"
import type { POSSale } from "@/lib/store"
import { withDemoTransaction } from "./demo-transaction"
import { distributePayment, type PaymentLine } from "@/lib/payments"
import { netItemValues } from "@/lib/utils/business-values"
import { stayBalance } from "@/lib/stays"

const money = z.number().finite().nonnegative().max(999999999).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < .00001)
const saleSchema = z.object({ globalDiscount: z.number().min(0).max(100), sale: z.object({
  id: z.string().min(1), items: z.array(z.object({ id: z.string().min(1), product: z.object({ id: z.string() }).passthrough(), quantity: z.number().int().positive(), discount: z.number().min(0).max(100) })).min(1),
  total: money, amountPaid: money, customer: z.string().optional(), stayId: z.string().optional(), stayVersion: z.number().int().optional(),
  payments: z.array(z.object({ method: z.string(), value: money, accountId: z.string().optional() })).optional(),
}) })

export function demoPOSOperation(store: DataStore, kind: string, payload: unknown, can: (p: string) => boolean, username: string) {
  return withDemoTransaction(store, async staged => {
    const demand = (permission: string) => { if (!can(permission)) throw Error("Você não tem permissão para esta ação") }
    const now = new Date().toISOString()
    const accounts = await staged.bankAccounts.getAll()
    async function ledger(saleId: string, lines: (PaymentLine & { applied?: number })[], reversal = false) {
      for (const line of lines) {
        const value = line.applied ?? line.value
        if (!value) continue
        let accountId = line.accountId
        if (line.method === "Dinheiro") {
          if (!(await staged.cashCloses.getAll()).some(c => c.status === "aberto")) throw Error("Abra o caixa para receber ou devolver dinheiro")
        } else {
          accountId ??= accounts.filter(a => a.active).length === 1 ? accounts.find(a => a.active)!.id : undefined
          const account = accounts.find(a => a.id === accountId && a.active)
          if (!account) throw Error("Selecione uma conta ativa para o pagamento")
          account.currentBalance = Math.round((account.currentBalance + (reversal ? -value : value)) * 100) / 100
          await staged.bankAccounts.update(account.id, { currentBalance: account.currentBalance })
        }
        await staged.transactions.create({ date: now, description: `${reversal ? "Estorno" : "Venda"} ${saleId}`, refId: `Venda ${saleId}`, value, type: reversal ? "estorno" : "receita", category: "PDV", paymentMethod: line.method, accountId, responsible: username, originType: reversal ? "sale-refund" : "sale", originId: saleId })
      }
    }
    async function stock(sale: POSSale, restore = false) {
      for (const item of sale.items) {
        if (!item.product.trackStock) continue
        const current = (await staged.stockItems.getAll()).find(s => s.productId === item.product.id)
        if (!current || !restore && current.currentStock < item.quantity) throw Error(`Estoque insuficiente para ${item.product.name}`)
        await staged.stockItems.update(current.id, { currentStock: current.currentStock + (restore ? item.quantity : -item.quantity) })
        await staged.stockMovements.create({ type: restore ? "entrada" : "saida", productId: item.product.id, productName: item.product.name, quantity: item.quantity, unit: current.unit, reason: `${restore ? "Estorno" : "Venda"} ${sale.id}`, timestamp: now, registeredBy: username })
      }
    }
    if (kind === "sale") {
      demand("pos.sell")
      const { sale: input, globalDiscount } = saleSchema.parse(payload)
      const existing = await staged.posSales.getById(input.id)
      if (existing) {
        if (existing.stayId !== input.stayId || existing.total !== input.total || JSON.stringify(existing.items.map(i => [i.id, i.product.id, i.quantity, i.discount])) !== JSON.stringify(input.items.map(i => [i.id, i.product.id, i.quantity, i.discount]))) throw Error("Esta confirmação já foi usada com outro carrinho. Reabra o pagamento.")
        return existing
      }
      const products = await staged.posProducts.getAll()
      const items = input.items.map(item => {
        const product = products.find(p => p.id === item.product.id && p.active !== false)
        if (!product) throw Error("Produto indisponível; atualize o carrinho")
        return { ...item, product }
      })
      if (new Set(items.map(i => i.id)).size !== items.length) throw Error("Itens duplicados")
      const subtotal = items.reduce((sum, i) => sum + Math.round(i.product.price * i.quantity * (1 - i.discount / 100) * 100), 0) / 100
      const discount = Math.round(subtotal * globalDiscount) / 100
      const total = Math.round((subtotal - discount) * 100) / 100
      if (Math.round(input.total * 100) !== Math.round(total * 100)) throw Error("Preço alterado. Atualize o carrinho.")
      if (items.some(i => i.discount > 0) || globalDiscount > 0) {
        const ceiling = (await staged.systemSettings.getAll())[0]?.discountCeiling ?? 0
        if (subtotal && (1 - total / items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)) * 100 > ceiling + .000001) demand("discount.override")
      }
      const stay = input.stayId ? await staged.stays.getById(input.stayId) : undefined
      if (input.stayId) {
        demand("consumptions.create")
        if (!stay || stay.status !== "active") throw Error("Hospedagem encerrada ou indisponível")
        if (items.some(i => stay.charges.some(c => c.id === i.id))) throw Error("Item já lançado na ficha")
        if (input.stayVersion !== stay.recordVersion) throw Error("Hospedagem alterada. Selecione novamente para revisar.")
        if (input.payments?.length || input.amountPaid !== 0) throw Error("Lançamento na ficha não recebe no caixa")
      }
      const payment = stay ? undefined : distributePayment(total, input.payments ?? [])
      const sale: POSSale = { id: input.id, date: now, items, subtotal, discount, total, stayId: stay?.id, payments: payment?.lines, paymentMethod: stay ? "Conta da hospedagem" : payment!.lines.length > 1 ? "Misto" : payment!.lines[0].method, amountPaid: payment?.offered ?? 0, change: payment?.change ?? 0, customer: stay?.guestName ?? input.customer, operator: username, status: "concluida" }
      await stock(sale)
      if (stay) {
        const amounts = netItemValues(sale)
        const projection = (await staged.consumptions.getAll()).find(c => c.roomId === stay.roomId)
        const charges = items.map((i, index) => ({ id: i.id, productId: i.product.id, sourceSaleId: sale.id, label: i.product.name, unitPrice: i.product.price, quantity: i.quantity, lineTotal: amounts[index], status: "active", createdAt: now }))
        await staged.stays.update(stay.id, { charges: [...stay.charges, ...charges], recordVersion: stay.recordVersion + 1 })
        const added = charges.map(c => ({ id: c.id, productId: c.productId, label: `${c.quantity} × ${c.label} (PDV)`, quantity: 1, unitPrice: c.lineTotal }))
        if (projection) await staged.consumptions.update(stay.roomId, { items: [...projection.items, ...added] })
        else await staged.consumptions.create({ roomId: stay.roomId, items: added })
      } else await ledger(sale.id, payment!.lines)
      await staged.posSales.create(sale)
      await staged.auditLog.create({ date: now, user: username, action: stay ? "Entrega lançada na ficha" : "Venda recebida", reference: sale.id })
      return sale
    }
    demand("pos.refund")
    const input = z.object({ saleId: z.string(), reason: z.string().trim().min(1), returnToStock: z.boolean() }).parse(payload)
    const sale = await staged.posSales.getById(input.saleId)
    if (!sale || sale.status !== "concluida") throw Error("Venda já estornada ou indisponível")
    if (sale.stayId) {
      const stay = await staged.stays.getById(sale.stayId)
      const charges = stay?.charges.filter(c => c.sourceSaleId === sale.id && c.status === "active") ?? []
      const value = charges.reduce((sum, c) => sum + (c.lineTotal ?? c.unitPrice * c.quantity), 0)
      if (!stay || stay.status !== "active" || Math.round(value * 100) > Math.round(stayBalance(stay).consumptionBalance * 100)) throw Error("Consumo já recebido ou hospedagem encerrada; concilie antes de estornar")
      await staged.stays.update(stay.id, { charges: stay.charges.map(c => c.sourceSaleId === sale.id ? { ...c, status: "corrected", reason: input.reason } : c), recordVersion: stay.recordVersion + 1 })
      const projection = (await staged.consumptions.getAll()).find(c => c.roomId === stay.roomId)
      if (projection) await staged.consumptions.update(stay.roomId, { items: projection.items.filter(i => !charges.some(c => c.id === i.id)) })
    } else await ledger(sale.id, sale.payments ?? [{ method: sale.paymentMethod, value: sale.total }], true)
    if (input.returnToStock) await stock(sale, true)
    await staged.posSales.update(sale.id, { status: "cancelada", cancelReason: input.reason })
    await staged.auditLog.create({ date: now, user: username, action: "Venda estornada", reference: `${sale.id} · ${input.reason}` })
    return { success: true }
  })
}
