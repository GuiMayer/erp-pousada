import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest"
import { randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/client"
import { authenticate, requireSession, hashToken, issueSession, type Actor } from "@/lib/server/auth"
import { executeOperation } from "@/lib/server/operations"
import { getCollection, createCollectionItem, deleteCollectionItem, updateCollectionItem, replaceCollection, exportAllCollections, importAllCollections, clearAllCollections } from "@/lib/server/db/relational-data-service"
import { authorizeCollection } from "@/lib/server/data-permissions"
import { assertSameOrigin } from "@/lib/server/http"
import { POST as operationRoute } from "@/app/api/operations/route"
import { GET as sessionRoute } from "@/app/api/auth/session/route"

const url = process.env.DATABASE_URL || ""
if (!new URL(url || "postgresql://localhost/invalid").pathname.endsWith("/erp_test")) throw new Error("Integração exige DATABASE_URL apontando exclusivamente para erp_test")
process.env.APP_URL = "http://localhost:3002"
const token = "a".repeat(64)
let actor: Actor
const request = (method = "GET", origin = "http://localhost:3002") => new NextRequest("http://localhost:3002/api/data/rooms", { method, headers: { cookie: `erp_session=${token}`, origin } })
const salePayload = (quantity = 1) => ({ sale: { id: randomUUID(), items: [{ id: randomUUID(), product: { id: "product" }, quantity, discount: 0 }], total: quantity * 10, amountPaid: quantity * 10, paymentMethod: "pix" }, globalDiscount: 0 })

beforeAll(async () => {
  await clearAllCollections()
  await prisma.systemSettings.deleteMany()
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users", "operation_receipts", "auth_rate_limits", "rooms", "product_categories", "transactions", "audit_entries" CASCADE')
  const user = await prisma.user.create({ data: { id: "supervisor", username: "supervisor-test", password: await bcrypt.hash("Strong-test-password-42", 12), role: "supervisor", active: true, createdBy: "test", fullName: "Supervisor de teste" } })
  const session = await prisma.authSession.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) } })
  actor = { id: user.id, username: user.username, role: "supervisor", sessionId: session.id, approvedUntil: null }
  await prisma.bankAccount.create({ data: { id: "test-bank", name: "Conta fictícia", type: "conta_corrente", initialBalance: 1000, currentBalance: 1000 } })
  await prisma.systemSettings.upsert({ where: { id: "settings-1" }, create: { id: "settings-1", pousadaName: "Homologação", checkInTime: "14:00", checkOutTime: "12:00", discountCeiling: 5 }, update: { discountCeiling: 5 } })
  await prisma.productCategory.create({ data: { id: "category", name: "Bebidas", color: "blue", icon: "Cup", active: true } })
  await prisma.pOSProduct.create({ data: { id: "product", name: "Água", categoryId: "category", price: 10, trackStock: true } })
  await prisma.stockItem.create({ data: { id: "stock", productId: "product", productName: "Água", currentStock: 10, minimumStock: 1, maximumStock: 100, lastPurchasePrice: 2, unit: "un", averageCost: 2 } })
  await prisma.room.create({ data: { id: 1, number: "101", type: "casal", status: "disponivel",  } })
})
afterAll(async () => { await prisma.$disconnect() })
beforeEach(async () => {
  await prisma.cashClose.deleteMany(); await prisma.bankAccount.update({ where: { id: "test-bank" }, data: { currentBalance: 1000 } })
  await executeOperation(actor, randomUUID(), "cash-open", { openingValue: 30 })
  await prisma.accountReceivable.deleteMany({ where: { sourceStayId: { not: null } } })
  await prisma.stay.deleteMany()
  await prisma.pOSSale.deleteMany(); await prisma.transaction.deleteMany(); await prisma.operationReceipt.deleteMany()
  await prisma.stockMovement.deleteMany(); await prisma.stockItem.update({ where: { id: "stock" }, data: { currentStock: 10, unit: "un" } })
  await prisma.pOSProduct.update({ where: { id: "product" }, data: { price: 10 } })
})

describe("Proteção das APIs e integridade de operações", () => {
  it("recusa sessão ausente e cookies forjados", async () => {
    const response = await sessionRoute(new NextRequest("http://localhost:3002/api/auth/session"))
    expect(response.status).toBe(401)
    await expect(requireSession(new NextRequest("http://localhost:3002", { headers: { cookie: `erp_session=${"b".repeat(64)}` } }))).rejects.toMatchObject({ status: 401 })
  })
  it("valida a sessão e não expõe senhas", async () => {
    expect((await requireSession(request())).id).toBe(actor.id)
    const users = await getCollection("users")
    expect(users[0]).not.toHaveProperty("password")
    const response = await issueSession({ id: actor.id, username: actor.username, role: actor.role })
    expect(response.headers.get("set-cookie")).toContain("HttpOnly")
    expect(await response.json()).not.toHaveProperty("user.password")
  })
  it("bloqueia sessão expirada e usuário inativo", async () => {
    await prisma.authSession.update({ where: { id: actor.sessionId }, data: { expiresAt: new Date(0) } })
    await expect(requireSession(request())).rejects.toMatchObject({ status: 401 })
    await prisma.authSession.update({ where: { id: actor.sessionId }, data: { expiresAt: new Date(Date.now() + 3600000) } })
    await prisma.user.update({ where: { id: actor.id }, data: { active: false } })
    await expect(requireSession(request())).rejects.toMatchObject({ status: 401 })
    await prisma.user.update({ where: { id: actor.id }, data: { active: true } })
  })
  it("recusa origem externa e alterações administrativas por operador", async () => {
    expect(() => assertSameOrigin(request("POST", "https://evil.example"))).toThrow()
    await prisma.user.update({ where: { id: actor.id }, data: { role: "operador" } })
    await expect(authorizeCollection(request("PATCH"), "rooms")).rejects.toMatchObject({ status: 403 })
    await prisma.user.update({ where: { id: actor.id }, data: { role: "supervisor" } })
  })
  it("autentica hash e limita tentativas inválidas", async () => {
    expect((await authenticate(actor.username, "Strong-test-password-42")).id).toBe(actor.id)
    for (let i = 0; i < 10; i++) await expect(authenticate(actor.username, "wrong")).rejects.toMatchObject({ status: 401 })
    await expect(authenticate(actor.username, "wrong")).rejects.toMatchObject({ status: 429 })
  }, 15000)
  it("grava venda, estoque e financeiro apenas uma vez em reenvios", async () => {
    const payload = salePayload(2); const key = randomUUID()
    await executeOperation(actor, key, "sale", payload)
    await executeOperation(actor, key, "sale", payload)
    expect(await prisma.pOSSale.count()).toBe(1)
    expect(await prisma.transaction.count()).toBe(1)
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(8)
    await expect(executeOperation(actor, key, "sale", salePayload())).rejects.toMatchObject({ status: 409 })
  })
  it("reverte tudo quando não há estoque", async () => {
    await expect(executeOperation(actor, randomUUID(), "sale", salePayload(11))).rejects.toMatchObject({ status: 409 })
    expect(await prisma.pOSSale.count()).toBe(0); expect(await prisma.transaction.count()).toBe(0)
    expect(await prisma.stockMovement.count()).toBe(0)
  })
  it("impede preço adulterado e desconto sem aprovação", async () => {
    const payload = salePayload(); payload.sale.total = 1
    await expect(executeOperation(actor, randomUUID(), "sale", payload)).rejects.toMatchObject({ status: 409 })
    payload.sale.total = 9; payload.globalDiscount = 10
    await expect(executeOperation({ ...actor, role: "operador" }, randomUUID(), "sale", payload)).rejects.toMatchObject({ status: 403 })
  })
  it("impede estoque negativo em vendas concorrentes", async () => {
    const results = await Promise.allSettled([executeOperation(actor, randomUUID(), "sale", salePayload(7)), executeOperation(actor, randomUUID(), "sale", salePayload(7))])
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(3)
  })
  it("estorna venda atomicamente e bloqueia estorno duplicado", async () => {
    const payload = salePayload(2)
    await executeOperation(actor, randomUUID(), "sale", payload)
    await executeOperation(actor, randomUUID(), "cancel-sale", { saleId: payload.sale.id, reason: "Teste de cancelamento", returnToStock: true })
    await expect(executeOperation(actor, randomUUID(), "cancel-sale", { saleId: payload.sale.id, reason: "Duplicado", returnToStock: true })).rejects.toMatchObject({ status: 409 })
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(10)
    expect(await prisma.transaction.count({ where: { type: "estorno" } })).toBe(1)
  })
  it("converte identificadores numéricos e reverte substituição inválida", async () => {
    await updateCollectionItem("rooms", "1", { number: "102", recordVersion: (await prisma.room.findUniqueOrThrow({ where: { id: 1 } })).recordVersion }, actor)
    expect((await prisma.room.findUniqueOrThrow({ where: { id: 1 } })).number).toBe("102")
    await expect(replaceCollection("rooms", [{ id: 2, number: "103" }])).rejects.toThrow()
    expect(await prisma.room.count()).toBe(1)
  })
  it("hospedagem impede saída com consumo e grava pagamento antes do check-out", async () => {
    await prisma.room.update({ where: { id: 1 }, data: { status: "disponivel", guest: null, guestCpf: null, checkIn: null, checkOut: null } })
    const operator = { ...actor, role: "operador" as const }
    const legacyStay = { roomId: 1, cpf: "52998224725", guestName: "Hóspede fictício", checkIn: "2026-10-07", checkOut: "2026-10-09", totalValue: 300 }
    await executeOperation(actor, randomUUID(), "reserve", legacyStay)
    await executeOperation(operator, randomUUID(), "check-in", legacyStay)
    const rooms = await getCollection("rooms")
    expect(rooms[0]).toHaveProperty("checkOut", "2026-10-09")
    await executeOperation(operator, randomUUID(), "add-consumption", { roomId: 1, item: { id: randomUUID(), label: "Água", unitPrice: 1, quantity: 1 } })
    await expect(executeOperation(operator, randomUUID(), "check-out", { roomId: 1 })).rejects.toMatchObject({ status: 409 })
    await executeOperation(operator, randomUUID(), "pay-consumption", { roomId: 1, paymentMethod: "pix" })
    const stay = await prisma.reservation.findFirstOrThrow({ where: { roomId: 1, status: "checkin" } })
    await executeOperation(operator, randomUUID(), "pay-reservation", { reservationId: stay.id, value: 300, paymentMethod: "pix" })
    await executeOperation(operator, randomUUID(), "check-out", { roomId: 1 })
    expect((await prisma.room.findUniqueOrThrow({ where: { id: 1 } })).status).toBe("limpeza")
    expect(await prisma.reservation.count({ where: { status: "checkout" } })).toBe(1)
    expect(Number((await prisma.transaction.findFirstOrThrow()).value)).toBe(10)
    await executeOperation(operator, randomUUID(), "release-room", { roomId: 1 })
  })
  it("comanda bloqueia edição desatualizada e baixa estoque uma vez", async () => {
    await prisma.restaurantTable.create({ data: { id: 1, number: "1", status: "livre", capacity: 4 } })
    const orderId = randomUUID()
    await executeOperation(actor, randomUUID(), "open-table", { tableId: 1, orderId })
    const edit = { orderId, expectedVersion: 0, items: [{ id: randomUUID(), productId: "product", quantity: 2 }], discountPercent: 0 }
    await executeOperation(actor, randomUUID(), "edit-order", edit)
    await expect(executeOperation(actor, randomUUID(), "edit-order", edit)).rejects.toMatchObject({ status: 409 })
    await executeOperation(actor, randomUUID(), "close-order", { orderId, expectedVersion: (await prisma.restaurantOrder.findUniqueOrThrow({ where: { id: orderId } })).version, paymentMethod: "pix", amountPaid: 20 })
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(8)
    expect((await prisma.restaurantTable.findUniqueOrThrow({ where: { id: 1 } })).status).toBe("livre")
  })
  it("produção usa estoque e custo persistidos na receita", async () => {
    await prisma.recipe.create({ data: { id: "recipe", name: "Receita fictícia", category: "bebida", version: 1, expectedYield: 1, yieldUnit: "un", preparationTime: 1, instructions: "Teste", ingredients: { create: [{ id: "ingredient", productId: "product", productName: "Água", quantity: 1, unit: "un", cost: 2 }] } } })
    await executeOperation(actor, randomUUID(), "production", { recipeId: "recipe", plannedQuantity: 3, producedQuantity: 3 })
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(7)
    expect(Number((await prisma.production.findFirstOrThrow()).totalCost)).toBe(6)
    await updateCollectionItem("recipes", "recipe", { recordVersion: (await prisma.recipe.findUniqueOrThrow({ where: { id: "recipe" } })).recordVersion, ingredients: [{ productId: "product", productName: "Água", quantity: 2, unit: "un", cost: 4 }] }, actor)
    expect(Number((await prisma.recipeIngredient.findFirstOrThrow({ where: { recipeId: "recipe" } })).quantity)).toBe(2)
  })
  it("pagamento de parcelas grava financeiro e recusa duplicação", async () => {
    await prisma.expense.create({ data: { id: "expense", description: "Despesa fictícia", category: "outros", value: 12, dueDate: new Date(), installments: { create: [{ id: "part-1", installmentNumber: 1, value: 6, dueDate: new Date() }, { id: "part-2", installmentNumber: 2, value: 6, dueDate: new Date() }] } } })
    await executeOperation(actor, randomUUID(), "pay-expense", { expenseId: "expense", installmentId: "part-1", paymentMethod: "pix" })
    await expect(executeOperation(actor, randomUUID(), "pay-expense", { expenseId: "expense", installmentId: "part-1", paymentMethod: "pix" })).rejects.toMatchObject({ status: 409 })
    await executeOperation(actor, randomUUID(), "pay-expense", { expenseId: "expense", installmentId: "part-2", paymentMethod: "pix" })
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: "expense" } })).paid).toBe(true)
    expect(await prisma.transaction.count()).toBe(2)
  })
  it("consumo de funcionário valida limite e baixa estoque", async () => {
    await prisma.employee.create({ data: { id: "employee", name: "Funcionário fictício", cpf: "11111111111", role: "cozinha", active: true, consumptionLimit: 15, mealBenefit: { lunchIncluded: false } } })
    await executeOperation(actor, randomUUID(), "employee-consumption", { employeeId: "employee", category: "almoco", paymentType: "desconto", items: [{ productId: "product", quantity: 1 }] })
    await expect(executeOperation(actor, randomUUID(), "employee-consumption", { employeeId: "employee", category: "almoco", paymentType: "desconto", items: [{ productId: "product", quantity: 1 }] })).rejects.toMatchObject({ status: 409 })
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(9)
  })
  it("preserva o último supervisor ativo", async () => {
    await expect(updateCollectionItem("users", actor.id, { role: "operador", recordVersion: (await prisma.user.findUniqueOrThrow({ where: { id: actor.id } })).recordVersion }, actor)).rejects.toMatchObject({ status: 409 })
    await expect(updateCollectionItem("users", actor.id, { active: false, recordVersion: (await prisma.user.findUniqueOrThrow({ where: { id: actor.id } })).recordVersion }, actor)).rejects.toMatchObject({ status: 409 })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: actor.id } })).active).toBe(true)
  })
  it("desconto recalcula reserva e exige aprovação acima do teto", async () => {
    const reservationId = randomUUID()
    await executeOperation(actor, randomUUID(), "reserve", { id: reservationId, roomId: 1, cpf: "52998224725", guestName: "Hóspede fictício", checkIn: "2026-10-20", checkOut: "2026-10-22", totalValue: 100 })
    const payload = { reservationId, type: "percent", value: 10 }
    await expect(executeOperation({ ...actor, role: "operador" }, randomUUID(), "reservation-discount", payload)).rejects.toMatchObject({ status: 403 })
    const key = randomUUID()
    await executeOperation(actor, key, "reservation-discount", payload)
    await executeOperation(actor, key, "reservation-discount", payload)
    expect(Number((await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).totalValue)).toBe(90)
  })
  it("fechamento soma fundo e dinheiro sem contar PIX", async () => {
    const cash = salePayload(2); cash.sale.paymentMethod = "dinheiro"
    await executeOperation(actor, randomUUID(), "sale", cash)
    await executeOperation(actor, randomUUID(), "sale", salePayload())
    const close = await executeOperation(actor, randomUUID(), "cash-close", { physicalValue: 50, sessionId: (await prisma.cashClose.findFirstOrThrow({ where: { status: "aberto" } })).id })
    expect(close).toHaveProperty("expectedValue", 50)
    expect(close).toHaveProperty("openingValue", 30)
    expect(close).toHaveProperty("divergence", 0)
  })
  it("hash de nova senha revoga sessões sem expor credenciais", async () => {
    const userId = randomUUID()
    const data = { id: userId, username: "operator-hash-test", fullName: "Operador", role: "operador", active: true, password: "New-strong-password-42" }
    const result = await createCollectionItem("users", data, actor)
    expect(result).not.toHaveProperty("password")
    expect(await bcrypt.compare(data.password, (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).password)).toBe(true)
    await prisma.authSession.create({ data: { userId, tokenHash: hashToken("c".repeat(64)), expiresAt: new Date(Date.now() + 60000) } })
    await updateCollectionItem("users", userId, { password: "Another-strong-password-42", recordVersion: (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).recordVersion }, actor)
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0)
    await deleteCollectionItem("users", userId)
  })
  it("exporta sem identidades e restaura snapshot completo", async () => {
    const usersBefore = await prisma.user.findMany({ orderBy: { id: "asc" } })
    const snapshot = await exportAllCollections()
    expect(JSON.parse(snapshot)).not.toHaveProperty("users")
    await importAllCollections(snapshot)
    expect(await prisma.room.count()).toBe(1)
    expect(await prisma.user.findMany({ orderBy: { id: "asc" } })).toEqual(usersBefore)
  })
})

let nextRoom = 100
const operator = () => ({ ...actor, role: "operador" as const, approvedUntil: null })
const operate = (kind: string, payload: unknown, as = actor) => executeOperation(as, randomUUID(), kind, payload)
async function newRoom() {
  const id = ++nextRoom
  return prisma.room.create({ data: { id, number: `T${id}`, type: "casal", status: "disponivel" } })
}
async function reserve(roomId: number, totalValue = 100) {
  const payload = { id: randomUUID(), roomId, cpf: "52998224725", guestName: "Hóspede fictício", checkIn: "2030-10-20", checkOut: "2030-10-22", totalValue }
  await operate("reserve", payload)
  return payload
}

describe("Regressões das regras de negócio", () => {
  it("não permite bloquear um período já reservado", async () => {
    const room = await newRoom()
    await reserve(room.id)
    await expect(updateCollectionItem("rooms", String(room.id), { status: "bloqueado", blockEndDate: "2030-10-21", recordVersion: room.recordVersion }, actor)).rejects.toMatchObject({ status: 409 })
    expect((await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).status).toBe("disponivel")
  })
  it("aceita desconto exatamente no teto sem erro de ponto flutuante", async () => {
    const sale = salePayload(); sale.sale.items[0].discount = 5; sale.sale.total = 9.5
    await operate("sale", sale, operator())
    expect(Number((await prisma.pOSSale.findUniqueOrThrow({ where: { id: sale.sale.id } })).total)).toBe(9.5)
  })
  it("despesa sem saldo em dinheiro reverte pagamento e lançamento", async () => {
    const expenseId = randomUUID()
    await prisma.expense.create({ data: { id: expenseId, description: "Despesa maior que o fundo", category: "outros", value: 31, dueDate: new Date() } })
    await expect(operate("pay-expense", { expenseId, paymentMethod: "dinheiro" })).rejects.toMatchObject({ status: 409 })
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } })).paid).toBe(false)
    expect(await prisma.transaction.count()).toBe(0)
  })
  it("dois recebimentos parciais com a mesma versão têm apenas um efeito", async () => {
    const room = await newRoom()
    await operate("check-in", { roomId: room.id, cpf: "52998224725", guestName: "Concorrência", checkIn: "2031-01-01", checkOut: "2031-01-03", totalValue: 300 })
    const stay = await prisma.reservation.findFirstOrThrow({ where: { roomId: room.id } })
    const payload = { reservationId: stay.id, recordVersion: stay.recordVersion, value: 100, paymentMethod: "pix" }
    const results = await Promise.allSettled([operate("pay-reservation", payload), operate("pay-reservation", payload)])
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
    expect(Number((await prisma.reservation.findUniqueOrThrow({ where: { id: stay.id } })).paidValue)).toBe(100)
    expect(await prisma.transaction.count({ where: { refId: `Hospedagem ${stay.id}` } })).toBe(1)
    const response = await operationRoute(new NextRequest("http://localhost:3002/api/operations", { method: "POST", headers: { cookie: `erp_session=${token}`, origin: "http://localhost:3002", "content-type": "application/json" }, body: JSON.stringify({ requestId: randomUUID(), kind: "pay-reservation", payload: { reservationId: stay.id, value: 100, paymentMethod: "pix" } }) }))
    expect(response.status).toBe(428)
    expect(await response.json()).toMatchObject({ code: "VERSION_REQUIRED" })
  })

  it("exige quitação da hospedagem mesmo sem consumo e aceita pagamentos parciais", async () => {
    const room = await newRoom()
    await operate("check-in", { roomId: room.id, cpf: "52998224725", guestName: "Teste", checkIn: "2030-01-01", checkOut: "2030-01-03", totalValue: 300 })
    const stay = await prisma.reservation.findFirstOrThrow({ where: { roomId: room.id } })
    await operate("pay-reservation", { reservationId: stay.id, value: 100, paymentMethod: "pix" }, operator())
    await expect(operate("check-out", { roomId: room.id })).rejects.toMatchObject({ status: 409 })
    expect((await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).status).toBe("ocupado")
    await operate("pay-reservation", { reservationId: stay.id, value: 200, paymentMethod: "pix" })
    await operate("check-out", { roomId: room.id })
    expect(Number((await prisma.transaction.aggregate({ _sum: { value: true } }))._sum.value)).toBe(300)
  })

  it("cancelamento futuro preserva o ocupante atual e recusa no-show antecipado", async () => {
    const room = await newRoom(), future = await reserve(room.id)
    await prisma.room.update({ where: { id: room.id }, data: { status: "ocupado", guest: "Ocupante atual" } })
    await expect(operate("cancel-reservation", { reservationId: future.id, status: "noshow", treatment: "multa", fee: 0 })).rejects.toMatchObject({ status: 409 })
    await operate("cancel-reservation", { reservationId: future.id, treatment: "estorno" }, operator())
    expect(await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).toMatchObject({ status: "ocupado", guest: "Ocupante atual" })
  })

  it("supervisor define multa e crédito, reutilizados sem duplicar receita", async () => {
    await prisma.guestProfile.update({ where: { cpf: "52998224725" }, data: { creditValue: 0 } })
    const first = await reserve((await newRoom()).id)
    await operate("pay-reservation", { reservationId: first.id, value: 100, paymentMethod: "pix" })
    const cancellation = { reservationId: first.id, treatment: "credito", fee: 20 }
    await expect(operate("cancel-reservation", cancellation, operator())).rejects.toMatchObject({ status: 403 })
    await operate("cancel-reservation", cancellation)
    expect(Number((await prisma.guestProfile.findUniqueOrThrow({ where: { cpf: first.cpf } })).creditValue)).toBe(80)
    expect(Number((await prisma.reservation.findUniqueOrThrow({ where: { id: first.id } })).cancellationFee)).toBe(20)
    const next = await reserve((await newRoom()).id, 80)
    await operate("pay-reservation", { reservationId: next.id, value: 80, paymentMethod: "credito_hospede" })
    expect(Number((await prisma.guestProfile.findUniqueOrThrow({ where: { cpf: first.cpf } })).creditValue)).toBe(0)
    expect(await prisma.transaction.count({ where: { type: "receita" } })).toBe(1)
    await expect(operate("cancel-reservation", cancellation)).rejects.toMatchObject({ status: 409 })
  })

  it("cancelamento com multa reembolsa a diferença pela conta original", async () => {
    const reservation = await reserve((await newRoom()).id)
    await operate("pay-reservation", { reservationId: reservation.id, value: 100, paymentMethod: "pix" })
    const receipt = await prisma.transaction.findFirstOrThrow({ where: { type: "receita" } })
    await expect(operate("refund-transaction", { transactionId: receipt.id })).rejects.toMatchObject({ status: 409 })
    await operate("cancel-reservation", { reservationId: reservation.id, treatment: "multa", fee: 20 })
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: "test-bank" } })).currentBalance)).toBe(1020)
    expect(Number((await prisma.transaction.findFirstOrThrow({ where: { type: "estorno" } })).value)).toBe(80)
  })

  it("impede redução por edição e descontos sucessivos que ultrapassam o teto", async () => {
    const reservation = await reserve((await newRoom()).id)
    await expect(operate("edit-reservation", { ...reservation, recordVersion: (await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).recordVersion, totalValue: 80 }, operator())).rejects.toMatchObject({ status: 403 })
    await operate("reservation-discount", { reservationId: reservation.id, type: "percent", value: 4 }, operator())
    await expect(operate("reservation-discount", { reservationId: reservation.id, type: "percent", value: 4 }, operator())).rejects.toMatchObject({ status: 403 })
    expect(Number((await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).totalValue)).toBe(96)
    const sale = salePayload(); sale.sale.items[0].discount = 5; sale.globalDiscount = 5; sale.sale.total = 9.02
    await expect(operate("sale", sale, operator())).rejects.toMatchObject({ status: 403 })
  })

  it("grupo é atômico e recusa datas bloqueadas sem impedir disponibilidade futura", async () => {
    const first = await newRoom(), blocked = await newRoom()
    await prisma.room.update({ where: { id: blocked.id }, data: { status: "bloqueado", blockEndDate: new Date("2030-10-21") } })
    const payload = { rooms: [{ roomId: first.id, totalValue: 100 }, { roomId: blocked.id, totalValue: 100 }], cpf: "52998224725", guestName: "Teste", checkIn: "2030-10-20", checkOut: "2030-10-22" }
    await expect(operate("reserve-group", payload)).rejects.toMatchObject({ status: 409 })
    expect(await prisma.reservation.count({ where: { roomId: first.id } })).toBe(0)
    await operate("reserve-group", { ...payload, checkIn: "2030-10-22", checkOut: "2030-10-24" })
    expect(await prisma.reservation.count({ where: { roomId: { in: [first.id, blocked.id] } } })).toBe(2)
  })

  it("check-in rejeita timestamps com fusos e períodos invertidos", async () => {
    const room = await newRoom()
    await expect(operate("check-in", { roomId: room.id, cpf: "52998224725", guestName: "Teste", checkIn: "2030-01-01T23:00:00-03:00", checkOut: "2030-01-02T00:00:00+03:00", totalValue: 100 })).rejects.toThrow()
    expect((await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).status).toBe("disponivel")
  })

  it("produção converte gramas em quilos e rejeita unidades incompatíveis", async () => {
    await prisma.stockItem.update({ where: { id: "stock" }, data: { unit: "kg" } })
    const recipeId = randomUUID()
    await prisma.recipe.create({ data: { id: recipeId, name: "Receita em gramas", category: "teste", version: 1, expectedYield: 1, yieldUnit: "un", preparationTime: 1, instructions: "Teste", ingredients: { create: [{ id: randomUUID(), productId: "product", productName: "Ingrediente", quantity: 10, unit: "g", cost: 0 }] } } })
    await operate("production", { recipeId, plannedQuantity: 1, producedQuantity: 1 })
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(9.99)
    expect(Number((await prisma.production.findFirstOrThrow({ where: { recipeId } })).totalCost)).toBe(0.02)
    await prisma.recipeIngredient.updateMany({ where: { recipeId }, data: { unit: "ml" } })
    await expect(operate("production", { recipeId, plannedQuantity: 1, producedQuantity: 1 })).rejects.toMatchObject({ status: 400 })
    expect(await prisma.production.count({ where: { recipeId } })).toBe(1)
  })

  it("recebimento é atômico, protege parcelas pagas e recusa recebimento duplicado", async () => {
    const customerId = randomUUID(), accountId = randomUUID(), part1 = randomUUID(), part2 = randomUUID()
    await prisma.customer.create({ data: { id: customerId, name: "Cliente fictício", cpfCnpj: "11222333000181" } })
    await prisma.accountReceivable.create({ data: { id: accountId, customerId, customerName: "Cliente", description: "Teste", value: 100, status: "pendente", issueDate: new Date(), dueDate: new Date(), installments: { create: [part1, part2].map((id, index) => ({ id, installmentNumber: index + 1, value: 50, dueDate: new Date(), status: "pendente" })) } } })
    await prisma.bankAccount.update({ where: { id: "test-bank" }, data: { active: false } })
    await expect(operate("receive-account", { accountReceivableId: accountId, installmentId: part1, paymentMethod: "pix", accountId: "test-bank" })).rejects.toMatchObject({ status: 409 })
    expect((await prisma.accountReceivableInstallment.findUniqueOrThrow({ where: { id: part1 } })).status).toBe("pendente")
    await prisma.bankAccount.update({ where: { id: "test-bank" }, data: { active: true } })
    const payment = { accountReceivableId: accountId, installmentId: part1, paymentMethod: "pix" }
    const results = await Promise.allSettled([operate("receive-account", payment), operate("receive-account", payment)])
    expect(results.filter(item => item.status === "fulfilled")).toHaveLength(1)
    await expect(deleteCollectionItem("accountsReceivable", accountId)).rejects.toMatchObject({ status: 409 })
    await expect(updateCollectionItem("accountsReceivable", accountId, { value: 200, recordVersion: (await prisma.accountReceivable.findUniqueOrThrow({ where: { id: accountId } })).recordVersion }, actor)).rejects.toMatchObject({ status: 409 })
    expect((await prisma.accountReceivable.findUniqueOrThrow({ where: { id: accountId } })).status).toBe("pendente")
    await operate("receive-account", { ...payment, installmentId: part2 })
    expect((await prisma.accountReceivable.findUniqueOrThrow({ where: { id: accountId } })).status).toBe("pago")
    expect(await prisma.transaction.count()).toBe(2)
  })

  it("despesa em dinheiro reduz o turno, sem repetir movimentos em outro turno", async () => {
    const expenseId = randomUUID()
    await prisma.expense.create({ data: { id: expenseId, description: "Despesa", category: "outros", value: 12, dueDate: new Date() } })
    await operate("pay-expense", { expenseId, paymentMethod: "Dinheiro" })
    const session = await prisma.cashClose.findFirstOrThrow({ where: { status: "aberto" } })
    expect(await operate("cash-close", { sessionId: session.id, physicalValue: 18 })).toHaveProperty("expectedValue", 18)
    await expect(operate("cash-close", { sessionId: session.id, physicalValue: 18 })).rejects.toMatchObject({ status: 409 })
    const cashSale = salePayload(); cashSale.sale.paymentMethod = "dinheiro"
    await expect(operate("sale", cashSale)).rejects.toMatchObject({ status: 409 })
    expect(await prisma.pOSSale.count()).toBe(0)
    const second = await operate("cash-open", { openingValue: 40 }) as { id: string }
    await operate("sale", cashSale)
    expect(await operate("cash-close", { sessionId: second.id, physicalValue: 50 })).toHaveProperty("expectedValue", 50)
  })

  it("comanda preserva preço contratado e exige versão atual no fechamento", async () => {
    const tableId = ++nextRoom, orderId = randomUUID(), itemId = randomUUID()
    await prisma.restaurantTable.create({ data: { id: tableId, number: String(tableId), status: "livre", capacity: 4 } })
    await operate("open-table", { tableId, orderId })
    await operate("edit-order", { orderId, expectedVersion: 0, items: [{ id: itemId, productId: "product", quantity: 1 }], discountPercent: 10 })
    await prisma.pOSProduct.update({ where: { id: "product" }, data: { price: 20 } })
    await operate("edit-order", { orderId, expectedVersion: (await prisma.restaurantOrder.findUniqueOrThrow({ where: { id: orderId } })).version, items: [{ id: itemId, productId: "product", quantity: 2 }], discountPercent: 10 })
    await expect(operate("close-order", { orderId, expectedVersion: 1, paymentMethod: "pix", amountPaid: 100 })).rejects.toMatchObject({ status: 409 })
    await operate("close-order", { orderId, expectedVersion: (await prisma.restaurantOrder.findUniqueOrThrow({ where: { id: orderId } })).version, paymentMethod: "pix", amountPaid: 18, discountPercent: 0 })
    expect(Number((await prisma.transaction.findFirstOrThrow()).value)).toBe(18)
  })

  it("venda arredonda por linha e cancelamento sem devolução não repõe estoque", async () => {
    await prisma.pOSProduct.update({ where: { id: "product" }, data: { price: 0.05 } })
    const sale = salePayload(); sale.sale.items.push({ ...sale.sale.items[0], id: randomUUID() }); sale.sale.items.forEach(item => { item.discount = 10 }); sale.sale.total = 0.10; sale.sale.amountPaid = 0.10
    await operate("sale", sale)
    expect(Number((await prisma.transaction.findFirstOrThrow()).value)).toBe(0.10)
    await operate("cancel-sale", { saleId: sale.sale.id, reason: "Produtos consumidos", returnToStock: false })
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(8)
  })

  it("transferência movimenta os dois saldos sem registrar receita ou despesa", async () => {
    const target = randomUUID()
    await prisma.bankAccount.create({ data: { id: target, name: "Destino", type: "conta_corrente", initialBalance: 0, currentBalance: 0 } })
    try {
      const payload = { fromAccountId: "test-bank", toAccountId: target, value: 100, description: "Teste" }
      await operate("bank-transfer", payload)
      expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: "test-bank" } })).currentBalance)).toBe(900)
      expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: target } })).currentBalance)).toBe(100)
      expect(await prisma.transaction.count({ where: { type: { in: ["receita", "despesa"] } } })).toBe(0)
      await expect(operate("bank-transfer", { ...payload, value: 901 })).rejects.toMatchObject({ status: 409 })
      expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: target } })).currentBalance)).toBe(100)
    } finally { await prisma.bankTransfer.deleteMany({ where: { toAccountId: target } }); await prisma.transaction.deleteMany({ where: { accountId: target } }); await prisma.bankAccount.delete({ where: { id: target } }) }
  })
})
