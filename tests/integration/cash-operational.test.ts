import { exportAllCollections, importAllCollections } from "@/lib/server/db/relational-data-service"
import { beforeEach, afterAll, describe, it, expect } from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { executeOperation } from "@/lib/server/operations"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import type { Actor } from "@/lib/server/auth"
import type { CashClose } from "@/lib/store"
import { businessDay } from "@/lib/utils/business-values"

if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw Error("Exige erp_test isolado")
let actor: Actor
const op = <T = unknown>(kind: string, payload: unknown, request = randomUUID()) => executeOperation(actor, request, kind, payload) as Promise<T>
const sale = (quantity = 1, extra = {}) => ({ globalDiscount: 0, sale: { id: randomUUID(), items: [{ id: randomUUID(), product: { id: "water" }, quantity, discount: 0 }], total: quantity * 10, amountPaid: quantity * 10, paymentMethod: "pix", accountId: "bank", ...extra } })
beforeEach(async () => {
  await prisma.$executeRawUnsafe("TRUNCATE customers, rooms, users, product_categories, transactions, bank_accounts, cash_closes, system_settings CASCADE")
  const user = await prisma.user.create({ data: { id: "cash-actor", username: "cash-actor", fullName: "Pessoa teste", password: "test-only", role: "supervisor", createdBy: "test" } })
  const session = await prisma.authSession.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 600000) } })
  actor = { id: user.id, username: user.username, sessionId: session.id, role: "supervisor", permissions: ALL_PERMISSIONS, approvedUntil: null }
  await prisma.bankAccount.create({ data: { id: "bank", name: "Banco", type: "conta_corrente", initialBalance: 0, currentBalance: 0 } })
  await prisma.customer.create({ data: { id: "person", name: "Pessoa", cpfCnpj: "52998224725", active: true, roles: ["guest", "payer"] } })
  await prisma.room.create({ data: { id: 1, number: "101", type: "casal", status: "disponivel", capacity: 1 } })
  await prisma.lodgingTariff.create({ data: { id: "tariff", name: "Uma pessoa", roomType: "casal", minGuests: 1, maxGuests: 1, pricePerPerson: 100, validFrom: new Date("2020-01-01") } })
  await prisma.productCategory.create({ data: { id: "drinks", name: "Bebidas", color: "blue", icon: "Cup" } })
  await prisma.pOSProduct.create({ data: { id: "water", name: "Água", price: 10, trackStock: true, categoryId: "drinks" } })
  await prisma.stockItem.create({ data: { id: "stock", productId: "water", productName: "Água", unit: "un", currentStock: 500, minimumStock: 1, maximumStock: 1000, averageCost: 2, lastPurchasePrice: 2 } })
  await prisma.stockLot.create({ data: { id: "lot", productId: "water", code: "TEST", origin: "test", quantity: 500, receivedQuantity: 500, unitCost: 2, remainingValue: 1000 } })
})
afterAll(() => prisma.$disconnect())
async function arrive() {
  const today = businessDay(), checkOut = new Date(Date.parse(today) + 2 * 86400000).toISOString().slice(0, 10)
  await op("check-in", { roomId: 1, guestCount: 1, cpf: "52998224725", guestName: "Pessoa", payerId: "person", checkIn: today, checkOut, totalValue: 200 })
  return prisma.stay.findFirstOrThrow({ where: { status: "active" } })
}
async function close(turn: CashClose, physicalValue: number) {
  const preview = await op<CashClose>("cash-preview", { sessionId: turn.id })
  return op<CashClose>("cash-close", { sessionId: turn.id, recordVersion: preview.recordVersion, physicalValue })
}

describe("Turno operacional e gaveta independentes", () => {
  it.each(["pix", "debito", "credito", "dinheiro", "ficha"])("bloqueia venda %s fechada sem venda, estoque ou cobrança parcial", async method => {
    const stay = await arrive()
    const payload = method === "ficha" ? sale(1, { stayId: stay.id, stayVersion: stay.recordVersion, amountPaid: 0 }) : sale(1, { paymentMethod: method, accountId: method === "dinheiro" ? undefined : method === "pix" ? "bank" : undefined })
    await expect(op("sale", payload)).rejects.toMatchObject({ status: 409 })
    await expect(op("add-consumption", { roomId: 1, expectedStayId: stay.id, item: { id: randomUUID(), productId: "water", label: "Água", quantity: 1, unitPrice: 10 } })).rejects.toMatchObject({ status: 409 })
    expect(await prisma.pOSSale.count()).toBe(0)
    expect(await prisma.stayCharge.count()).toBe(0)
    expect(await prisma.transaction.count()).toBe(0)
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(500)
  })
  it("recebe na recepção fora do turno por PIX/cartão e mantém dinheiro bloqueado", async () => {
    const stay = await arrive()
    await op("stay-receive", { stayId: stay.id, recordVersion: 0, value: 40, paymentMethod: "pix", accountId: "bank" })
    const current = await prisma.stay.findUniqueOrThrow({ where: { id: stay.id } })
    await op("stay-receive", { stayId: stay.id, recordVersion: current.recordVersion, value: 60, paymentMethod: "credito" })
    const updated = await prisma.stay.findUniqueOrThrow({ where: { id: stay.id } })
    await expect(op("stay-receive", { stayId: stay.id, recordVersion: updated.recordVersion, value: 10, paymentMethod: "dinheiro" })).rejects.toMatchObject({ status: 409 })
    expect((await prisma.transaction.findMany()).every(t => !t.operationalSessionId && !t.cashSessionId)).toBe(true)
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: "bank" } })).currentBalance)).toBe(40)
    expect(Number((await prisma.bankAccount.findFirstOrThrow({ where: { type: "cartao" } })).currentBalance)).toBe(60)
  })
  it("congela resumo por meio, recusa prévia antiga, replay não repete venda e estorno não reescreve turno anterior", async () => {
    const turn = await op<CashClose>("cash-open", { openingValue: 100 })
    const cash = sale(20, { paymentMethod: "dinheiro", accountId: undefined, amountPaid: 250 })
    await op("sale", cash)
    await op("sale", sale(30))
    const card = sale(40, { paymentMethod: "credito", accountId: undefined }), request = randomUUID()
    await op("sale", card, request)
    const stay = await arrive()
    await op("sale", sale(5, { stayId: stay.id, stayVersion: stay.recordVersion, amountPaid: 0 }))
    const preview = await op<CashClose>("cash-preview", { sessionId: turn.id })
    expect(preview.closingSummary!.methods.reduce((n, m) => n + m.received, 0)).toBe(900)
    expect(preview.closingSummary!.deferred).toEqual({ value: 50, count: 1 })
    expect(preview.closingSummary!.expectedValue).toBe(300)
    await op("sale", sale())
    await expect(op("cash-close", { sessionId: turn.id, recordVersion: preview.recordVersion, physicalValue: 300 })).rejects.toMatchObject({ details: { code: "CASH_CHANGED" } })
    const closed = await close(turn, 300)
    await op("sale", card, request)
    await expect(op("cancel-sale", { saleId: card.sale.id, reason: "Teste", returnToStock: false })).rejects.toMatchObject({ status: 409 })
    await op("cash-open", { openingValue: 300 })
    await op("cancel-sale", { saleId: card.sale.id, reason: "Ajuste autorizado", returnToStock: false })
    expect((await prisma.cashClose.findUniqueOrThrow({ where: { id: turn.id } })).closingSummary).toEqual(closed.closingSummary)
    const stock = await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })
    expect(Number(stock.currentStock)).toBe(404)
  })
  it("repasse com taxa é atômico e idempotente, fora do turno, sem nova receita", async () => {
    const turn = await op<CashClose>("cash-open", { openingValue: 0 })
    await op("sale", sale(10, { paymentMethod: "credito", accountId: undefined }))
    await close(turn, 0)
    const card = await prisma.bankAccount.findFirstOrThrow({ where: { type: "cartao" } })
    const payload = { fromAccountId: card.id, toAccountId: "bank", gross: 100, fee: 3 }, request = randomUUID()
    await op("card-payout", payload, request); await op("card-payout", payload, request)
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: "bank" } })).currentBalance)).toBe(97)
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: card.id } })).currentBalance)).toBe(0)
    expect(await prisma.transaction.count({ where: { type: "receita" } })).toBe(1)
    expect(Number((await prisma.transaction.findFirstOrThrow({ where: { type: "despesa" } })).value)).toBe(3)
    await expect(op("card-payout", payload)).rejects.toMatchObject({ status: 409 })
  })
  it("venda concorrente ao fechamento ou entra antes da revisão ou falha sem efeitos", async () => {
    const turn = await op<CashClose>("cash-open", { openingValue: 0 })
    const preview = await op<CashClose>("cash-preview", { sessionId: turn.id })
    const results = await Promise.allSettled([op("sale", sale()), op("cash-close", { sessionId: turn.id, recordVersion: preview.recordVersion, physicalValue: 0 })])
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
    if (results[0].status === "fulfilled") {
      expect((await prisma.cashClose.findUniqueOrThrow({ where: { id: turn.id } })).status).toBe("aberto")
      expect(await prisma.transaction.count()).toBe(1)
    } else {
      expect(await prisma.pOSSale.count()).toBe(0)
      expect(await prisma.transaction.count()).toBe(0)
    }
  })
})

it("backup restaura venda na ficha, entrega manual, turno e resumo sem perder relações", async () => {
  const turn = await op<CashClose>("cash-open", {openingValue:0}), stay = await arrive()
  const delivery = sale(2, {stayId:stay.id,stayVersion:stay.recordVersion,amountPaid:0})
  await op("sale", delivery)
  await op("add-consumption", {roomId:1,expectedStayId:stay.id,item:{id:"manual-water",productId:"water",label:"Água",unitPrice:10,quantity:1}})
  const closed = await close(turn, 0)
  const snapshot = await exportAllCollections()
  await importAllCollections(snapshot, actor)
  expect((await prisma.pOSSale.findUniqueOrThrow({where:{id:delivery.sale.id}})).stayId).toBe(stay.id)
  expect((await prisma.stayCharge.findUniqueOrThrow({where:{id:"manual-water"}})).operationalSessionId).toBe(turn.id)
  expect((await prisma.cashClose.findUniqueOrThrow({where:{id:turn.id}})).closingSummary).toEqual(closed.closingSummary)
  expect(Number((await prisma.stockItem.findUniqueOrThrow({where:{id:"stock"}})).currentStock)).toBe(497)
})
