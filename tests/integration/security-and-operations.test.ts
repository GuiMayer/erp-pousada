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
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users", "operation_receipts", "auth_rate_limits", "rooms", "product_categories", "transactions", "audit_entries" CASCADE')
  const user = await prisma.user.create({ data: { id: "supervisor", username: "supervisor-test", password: await bcrypt.hash("Strong-test-password-42", 12), role: "supervisor", active: true, createdBy: "test", fullName: "Supervisor de teste" } })
  const session = await prisma.authSession.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) } })
  actor = { id: user.id, username: user.username, role: "supervisor", sessionId: session.id, approvedUntil: null }
  await prisma.productCategory.create({ data: { id: "category", name: "Bebidas", color: "blue", icon: "Cup", active: true } })
  await prisma.pOSProduct.create({ data: { id: "product", name: "Água", categoryId: "category", price: 10, trackStock: true } })
  await prisma.stockItem.create({ data: { id: "stock", productId: "product", productName: "Água", currentStock: 10, minimumStock: 1, maximumStock: 100, lastPurchasePrice: 2, unit: "un", averageCost: 2 } })
  await prisma.room.create({ data: { id: 1, number: "101", type: "casal", status: "disponivel",  } })
})
afterAll(async () => { await prisma.$disconnect() })
beforeEach(async () => {
  await prisma.pOSSale.deleteMany(); await prisma.transaction.deleteMany(); await prisma.operationReceipt.deleteMany()
  await prisma.stockMovement.deleteMany(); await prisma.stockItem.update({ where: { id: "stock" }, data: { currentStock: 10 } })
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
    for (let i = 0; i < 9; i++) await expect(authenticate(actor.username, "wrong")).rejects.toMatchObject({ status: 401 })
    await expect(authenticate(actor.username, "wrong")).rejects.toMatchObject({ status: 429 })
  })
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
    await executeOperation(actor, randomUUID(), "cancel-sale", { saleId: payload.sale.id, reason: "Teste de cancelamento" })
    await expect(executeOperation(actor, randomUUID(), "cancel-sale", { saleId: payload.sale.id, reason: "Duplicado" })).rejects.toMatchObject({ status: 409 })
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(10)
    expect(await prisma.transaction.count({ where: { type: "estorno" } })).toBe(1)
  })
  it("converte identificadores numéricos e reverte substituição inválida", async () => {
    await updateCollectionItem("rooms", "1", { number: "102" }, actor)
    expect((await prisma.room.findUniqueOrThrow({ where: { id: 1 } })).number).toBe("102")
    await expect(replaceCollection("rooms", [{ id: 2, number: "103" }])).rejects.toThrow()
    expect(await prisma.room.count()).toBe(1)
  })
  it("hospedagem impede saída com consumo e grava pagamento antes do check-out", async () => {
    await prisma.room.update({ where: { id: 1 }, data: { status: "disponivel", guest: null, guestCpf: null, checkIn: null, checkOut: null } })
    const operator = { ...actor, role: "operador" as const }
    await executeOperation(operator, randomUUID(), "check-in", { roomId: 1, cpf: "52998224725", guestName: "Hóspede fictício", checkIn: "2026-10-07", checkOut: "2026-10-09", totalValue: 300 })
    const rooms = await getCollection("rooms")
    expect(rooms[0]).toHaveProperty("checkOut", "2026-10-09")
    await executeOperation(operator, randomUUID(), "add-consumption", { roomId: 1, item: { id: randomUUID(), label: "Água", unitPrice: 1, quantity: 1 } })
    await expect(executeOperation(operator, randomUUID(), "check-out", { roomId: 1 })).rejects.toMatchObject({ status: 409 })
    await executeOperation(operator, randomUUID(), "pay-consumption", { roomId: 1, paymentMethod: "pix" })
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
    await executeOperation(actor, randomUUID(), "close-order", { orderId, paymentMethod: "pix", amountPaid: 20, discountPercent: 0 })
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(8)
    expect((await prisma.restaurantTable.findUniqueOrThrow({ where: { id: 1 } })).status).toBe("livre")
  })
  it("produção usa estoque e custo persistidos na receita", async () => {
    await prisma.recipe.create({ data: { id: "recipe", name: "Receita fictícia", category: "bebida", version: 1, expectedYield: 1, yieldUnit: "un", preparationTime: 1, instructions: "Teste", ingredients: { create: [{ id: "ingredient", productId: "product", productName: "Água", quantity: 1, unit: "un", cost: 2 }] } } })
    await executeOperation(actor, randomUUID(), "production", { recipeId: "recipe", plannedQuantity: 3, producedQuantity: 3 })
    expect(Number((await prisma.stockItem.findUniqueOrThrow({ where: { id: "stock" } })).currentStock)).toBe(7)
    expect(Number((await prisma.production.findFirstOrThrow()).totalCost)).toBe(6)
    await updateCollectionItem("recipes", "recipe", { ingredients: [{ productId: "product", productName: "Água", quantity: 2, unit: "un", cost: 4 }] }, actor)
    expect(Number((await prisma.recipeIngredient.findFirstOrThrow({ where: { recipeId: "recipe" } })).quantity)).toBe(2)
  })
  it("pagamento de parcelas grava financeiro e recusa duplicação", async () => {
    await prisma.expense.create({ data: { id: "expense", description: "Despesa fictícia", category: "outros", value: 12, dueDate: new Date(), installments: { create: [{ id: "part-1", installmentNumber: 1, value: 6, dueDate: new Date() }, { id: "part-2", installmentNumber: 2, value: 6, dueDate: new Date() }] } } })
    await executeOperation(actor, randomUUID(), "pay-expense", { expenseId: "expense", installmentId: "part-1" })
    await expect(executeOperation(actor, randomUUID(), "pay-expense", { expenseId: "expense", installmentId: "part-1" })).rejects.toMatchObject({ status: 409 })
    await executeOperation(actor, randomUUID(), "pay-expense", { expenseId: "expense", installmentId: "part-2" })
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
    await expect(updateCollectionItem("users", actor.id, { role: "operador" }, actor)).rejects.toMatchObject({ status: 409 })
    await expect(updateCollectionItem("users", actor.id, { active: false }, actor)).rejects.toMatchObject({ status: 409 })
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
    const close = await executeOperation(actor, randomUUID(), "cash-close", { physicalValue: 50, openingValue: 30 })
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
    await updateCollectionItem("users", userId, { password: "Another-strong-password-42" }, actor)
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0)
    await deleteCollectionItem("users", userId)
  })
  it("exporta sem identidades e restaura snapshot completo", async () => {
    const snapshot = await exportAllCollections()
    expect(JSON.parse(snapshot)).not.toHaveProperty("users")
    await importAllCollections(snapshot)
    expect(await prisma.room.count()).toBe(1)
    expect(await prisma.user.count()).toBe(1)
  })
})
