import { beforeAll, afterAll, describe, it, expect } from "vitest"
import { randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/client"
import { hashToken, requireSession, issueSession, authenticate } from "@/lib/server/auth"
import { authorizeCollection } from "@/lib/server/data-permissions"
import { clearAllCollections, createCollectionItem, updateCollectionItem, getCollection, exportAllCollections } from "@/lib/server/db/relational-data-service"
import { executeOperation } from "@/lib/server/operations"
import { POST as approvalRoute } from "@/app/api/auth/supervisor/route"
import { POST as operationRoute } from "@/app/api/operations/route"
import { POST as logoutRoute } from "@/app/api/auth/logout/route"
import { POST as importRoute } from "@/app/api/data/import/route"
import { GET as collectionRoute } from "@/app/api/data/[key]/route"
import { POST as createRoute } from "@/app/api/data/[key]/items/route"
import { effectivePermissions, operationPermissions, ALL_PERMISSIONS } from "@/lib/permissions"

if (!new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname.endsWith("/erp_test")) throw new Error("Use exclusivamente erp_test")
process.env.APP_URL = "http://localhost:3002"
const password = "Example-permissions-password-42"
const token = (user: string) => hashToken(`permissions-test:${user}`)
const request = (user: string, path = "/api/operations", body?: unknown, method = body ? "POST" : "GET") => new NextRequest(`http://localhost:3002${path}`, { method, headers: { cookie: `erp_session=${token(user)}`, origin: "http://localhost:3002", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) })
const actor = (user: string) => requireSession(request(user))
async function editUser(userId: string, changes: Record<string, unknown>) {
  const current = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  return updateCollectionItem("users", userId, { ...changes, recordVersion: current.recordVersion }, await actor("permissions-admin"))
}
const sale = () => ({ sale: { id: randomUUID(), items: [{ id: randomUUID(), product: { id: "permissions-product" }, quantity: 1, discount: 0 }], total: 9, amountPaid: 9, paymentMethod: "pix", accountId: "permissions-bank" }, globalDiscount: 10 })
const operation = (user: string, requestId: string, payload: unknown, kind = "sale") => operationRoute(request(user, "/api/operations", { requestId, kind, payload }))
const approve = async (user: string, requestId: string, payload: unknown, permission = "discount.override", kind = "sale") => {
  const challenge = await (await operation(user, requestId, payload, kind)).json()
  return approvalRoute(request(user, "/api/auth/supervisor", { username: "permissions-approver", password, requestId, kind, payload, permission, resourceHash: challenge.resourceHash ?? hashToken("null") }))
}

beforeAll(async () => {
  await clearAllCollections()
  await prisma.$executeRawUnsafe('TRUNCATE "users", "auth_rate_limits", "operation_receipts", "operation_approvals", "audit_entries", "system_settings" CASCADE')
  const hash = await bcrypt.hash(password, 12)
  for (const [suffix, profile] of Object.entries({ admin: "administrador", approver: "supervisor", reception: "recepcao", cashier: "caixa", restaurant: "restaurante", stock: "estoque", custom: "personalizado" })) {
    const id = `permissions-${suffix}`
    await prisma.user.create({ data: { id, username: id, password: hash, fullName: id, role: ["admin", "approver"].includes(suffix) ? "supervisor" : "operador", accessProfile: profile, createdBy: "test" } })
    const session = await prisma.authSession.create({ data: { userId: id, tokenHash: hashToken(token(id)), expiresAt: new Date(Date.now() + 3_600_000) } })
    await prisma.userSession.create({ data: { id: session.id, userId: id, username: id } })
  }
  await prisma.systemSettings.create({ data: { id: "settings-1", pousadaName: "Permissões fictícias", checkInTime: "14:00", checkOutTime: "12:00", discountCeiling: 5 } })
  await prisma.productCategory.create({ data: { id: "permissions-category", name: "Exemplos", color: "blue", icon: "Cup" } })
  await prisma.pOSProduct.create({ data: { id: "permissions-product", name: "Água fictícia", categoryId: "permissions-category", price: 10, trackStock: false } })
  await prisma.bankAccount.create({ data: { id: "permissions-bank", name: "Conta fictícia", type: "conta_corrente", initialBalance: 500, currentBalance: 500 } })
  await prisma.room.create({ data: { id: 1, number: "101", type: "casal", status: "disponivel" } })
})
afterAll(async () => { await prisma.$disconnect() })

describe("Permissões individuais e múltiplos usuários", () => {
  it("o catálogo contempla todas as operações e o administrador", () => {
    expect(Object.values(operationPermissions).every(key => ALL_PERMISSIONS.includes(key))).toBe(true)
    expect(effectivePermissions({ accessProfile: "administrador" })).toEqual([...ALL_PERMISSIONS].sort())
  })
  it.each(["permissions-reception", "permissions-cashier", "permissions-restaurant", "permissions-stock"])("%s não consulta usuários, funcionários nem lançamentos financeiros", async user => {
    for (const key of ["users", "employees", "transactions", "auditLog"]) await expect(authorizeCollection(request(user), key)).rejects.toMatchObject({ status: 403 })
  })
  it("seleciona conta sem expor saldo, agência ou número", async () => {
    const response = await collectionRoute(request("permissions-cashier"), { params: Promise.resolve({ key: "bankAccounts" }) })
    expect(response.status).toBe(200)
    const rows = await response.json()
    expect(rows[0]).toEqual({ id: "permissions-bank", name: "Conta fictícia", type: "conta_corrente", active: true })
  })
  it("recusa chamada direta fora do setor antes de escrever", async () => {
    const response = await operation("permissions-stock", randomUUID(), sale())
    expect(response.status).toBe(403)
    expect(await prisma.pOSSale.count()).toBe(0)
    expect(await prisma.transaction.count()).toBe(0)
  })
  it("personalizado começa sem acesso; permite e bloqueia por usuário", async () => {
    expect((await actor("permissions-custom")).permissions).toEqual([])
    await editUser("permissions-custom", { permissionOverrides: { "rooms.read": "allow", "expenses.read": "deny" } })
    await expect(authorizeCollection(request("permissions-custom"), "rooms")).resolves.toBeDefined()
    await expect(authorizeCollection(request("permissions-custom"), "expenses")).rejects.toMatchObject({ status: 403 })
  })
  it("alteração de perfil vale na mesma sessão e no ator antigo", async () => {
    const oldActor = await actor("permissions-reception")
    await editUser(oldActor.id, { accessProfile: "restaurante" })
    expect((await actor(oldActor.id)).permissions).not.toContain("reservations.create")
    await expect(executeOperation(oldActor, randomUUID(), "reserve", {})).rejects.toMatchObject({ status: 403 })
    await editUser(oldActor.id, { accessProfile: "recepcao" })
  })
  it("quem administra acessos não pode conceder privilégios superiores nem tomar a senha de conta superior", async () => {
    await editUser("permissions-custom", { permissionOverrides: { "users.manage": "allow", "users.read": "allow", "users.edit": "allow", "users.create": "allow" } })
    const limited = await actor("permissions-custom")
    const current = await prisma.user.findUniqueOrThrow({ where: { id: "permissions-cashier" } })
    await expect(updateCollectionItem("users", current.id, { accessProfile: "administrador", recordVersion: current.recordVersion }, limited)).rejects.toMatchObject({ status: 403 })
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: "permissions-admin" } })
    await expect(updateCollectionItem("users", admin.id, { password, recordVersion: admin.recordVersion }, limited)).rejects.toMatchObject({ status: 403 })
    await editUser("permissions-custom", { permissionOverrides: {} })
  })
  it("preserva administrador capaz de gerenciar acessos", async () => {
    await expect(editUser("permissions-admin", { permissionOverrides: { "users.edit": "deny" } })).rejects.toMatchObject({ status: 409 })
    await expect(editUser("permissions-admin", { active: false })).rejects.toMatchObject({ status: 409 })
  })
  it("a antiga janela global de aprovação não autoriza desconto", async () => {
    const user = await actor("permissions-cashier")
    await prisma.authSession.update({ where: { id: user.sessionId }, data: { approvedUntil: new Date(Date.now() + 300_000) } })
    expect((await operation(user.id, randomUUID(), sale())).status).toBe(403)
    expect((await approvalRoute(request(user.id, "/api/auth/supervisor", { password }))).status).toBe(400)
  })
  it("aprovação é restrita aos valores, requestId, usuário e sessão", async () => {
    const id = randomUUID(), payload = sale()
    expect((await approve("permissions-cashier", id, payload)).status).toBe(200)
    const changed = { ...payload, globalDiscount: 20, sale: { ...payload.sale, total: 8 } }
    expect((await operation("permissions-cashier", id, changed)).status).toBe(403)
    expect((await operation("permissions-cashier", randomUUID(), payload)).status).toBe(403)
    await prisma.operationApproval.updateMany({ where: { requestId: id }, data: { sessionId: "different-session" } })
    expect((await operation("permissions-cashier", id, payload)).status).toBe(403)
    await prisma.operationApproval.updateMany({ where: { requestId: id }, data: { sessionId: (await actor("permissions-cashier")).sessionId } })
    expect((await operation("permissions-cashier", id, payload)).status).toBe(200)
    expect((await operation("permissions-cashier", id, payload)).status).toBe(200)
    expect(await prisma.pOSSale.count({ where: { id: payload.sale.id } })).toBe(1)
    expect((await prisma.operationApproval.findFirstOrThrow({ where: { requestId: id } })).usedAt).not.toBeNull()
    const audit = await prisma.auditEntry.findFirstOrThrow({ where: { entityId: id, action: "Operação aprovada" } })
    expect(audit.metadata).toMatchObject({ approverId: "permissions-approver", executorId: "permissions-cashier" })
  })
  it("aprovação expirada é recusada", async () => {
    const id = randomUUID(), payload = sale()
    await approve("permissions-cashier", id, payload)
    await prisma.operationApproval.updateMany({ where: { requestId: id }, data: { expiresAt: new Date(0) } })
    expect((await operation("permissions-cashier", id, payload)).status).toBe(403)
  })
  it("mudança de privilégios do aprovador revoga sua aprovação", async () => {
    const id = randomUUID(), payload = sale()
    await approve("permissions-cashier", id, payload)
    await editUser("permissions-approver", { accessProfile: "personalizado" })
    expect((await operation("permissions-cashier", id, payload)).status).toBe(403)
    await editUser("permissions-approver", { accessProfile: "supervisor" })
  })
  it("bloqueio explícito do executor prevalece sobre aprovação anterior", async () => {
    const id = randomUUID(), payload = sale()
    await approve("permissions-cashier", id, payload)
    await editUser("permissions-cashier", { permissionOverrides: { "discount.override": "deny" } })
    const response = await operation("permissions-cashier", id, payload)
    expect(response.status).toBe(403)
    expect((await response.json()).approvalRequired).toBe(false)
    await editUser("permissions-cashier", { permissionOverrides: {} })
  })
  it("recusa supervisor sem a permissão específica para aprovar", async () => {
    await editUser("permissions-approver", { permissionOverrides: { "discount.override": "deny" } })
    expect((await approve("permissions-cashier", randomUUID(), sale())).status).toBe(403)
    await editUser("permissions-approver", { permissionOverrides: {} })
  })
  it("auditoria não aceita ações inventadas pelo cliente", async () => {
    const response = await createRoute(request("permissions-admin", "/api/data/auditLog/items", { id: randomUUID(), user: "fake", action: "fake", reference: "fake", date: new Date().toISOString() }), { params: Promise.resolve({ key: "auditLog" }) })
    expect(response.status).toBe(403)
    expect(await prisma.auditEntry.count({ where: { action: "fake" } })).toBe(0)
  })
  it("usuário criado e alteração são auditados sem senha", async () => {
    const id = randomUUID()
    await createCollectionItem("users", { id, username: id, password, role: "operador", accessProfile: "personalizado", fullName: "Exemplo", active: true }, await actor("permissions-admin"))
    await editUser(id, { fullName: "Nome atualizado" })
    const rows = await prisma.auditEntry.findMany({ where: { entityId: id } })
    expect(rows).toHaveLength(2)
    expect(JSON.stringify(rows)).not.toContain(password)
    expect((await getCollection("users")).every(user => !("password" in (user as object)))).toBe(true)
  })
  it("recusa duas edições do mesmo cadastro a partir da mesma versão", async () => {
    const room = await prisma.room.findUniqueOrThrow({ where: { id: 1 } })
    const admin = await actor("permissions-admin")
    const results = await Promise.allSettled([updateCollectionItem("rooms", "1", { number: "102", recordVersion: room.recordVersion }, admin), updateCollectionItem("rooms", "1", { number: "103", recordVersion: room.recordVersion }, admin)])
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1)
  })
  it("recusa edição de reserva baseada em formulário antigo", async () => {
    const reception = await actor("permissions-reception")
    const input = { roomId: 1, cpf: "52998224725", guestName: "Hóspede fictício", checkIn: "2035-01-10", checkOut: "2035-01-12", totalValue: 100 }
    const reservation = await executeOperation(reception, randomUUID(), "reserve", input) as { id: string; recordVersion: number }
    const edited = { ...input, id: reservation.id, recordVersion: reservation.recordVersion, checkOut: "2035-01-13" }
    await executeOperation(reception, randomUUID(), "edit-reservation", edited)
    await expect(executeOperation(reception, randomUUID(), "edit-reservation", { ...edited, checkOut: "2035-01-14" })).rejects.toMatchObject({ status: 409 })
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).checkOut.toISOString()).toContain("2035-01-13")
  })
  it("novo recebimento invalida aprovação de cancelamento do valor anterior", async () => {
    const reception = await actor("permissions-reception")
    const reservation = await prisma.reservation.findFirstOrThrow({ where: { status: "confirmada" } })
    await executeOperation(reception, randomUUID(), "pay-reservation", { reservationId: reservation.id, value: 20, paymentMethod: "pix", accountId: "permissions-bank" })
    const id = randomUUID(), payload = { reservationId: reservation.id, treatment: "estorno", fee: 0 }
    expect((await approve(reception.id, id, payload, "reservations.paidCancel", "cancel-reservation")).status).toBe(200)
    await executeOperation(reception, randomUUID(), "pay-reservation", { reservationId: reservation.id, value: 10, paymentMethod: "pix", accountId: "permissions-bank" })
    expect((await operation(reception.id, id, payload, "cancel-reservation")).status).toBe(403)
    expect(Number((await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).paidValue)).toBe(30)
  })
  it("encerrar uma sessão preserva as outras; desativar encerra todas e registra o histórico", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: "permissions-restaurant" } })
    const response = await issueSession(user)
    const cookie = response.headers.get("set-cookie")!.split(";")[0]
    expect((await logoutRoute(new NextRequest("http://localhost:3002/api/auth/logout", { method: "POST", headers: { cookie, origin: "http://localhost:3002" } }))).status).toBe(200)
    await expect(actor(user.id)).resolves.toBeDefined()
    await issueSession(user)
    await editUser(user.id, { active: false })
    await expect(actor(user.id)).rejects.toMatchObject({ status: 401 })
    expect(await prisma.authSession.count({ where: { userId: user.id } })).toBe(0)
    expect(await prisma.userSession.count({ where: { userId: user.id, logoutTime: null } })).toBe(0)
  })
  it("o responsável pelo caixa é identificado por ID, inclusive após trocar o login", async () => {
    const cashier = await actor("permissions-cashier")
    const cash = await executeOperation(cashier, randomUUID(), "cash-open", { openingValue: 0 }) as { id: string }
    await editUser(cashier.id, { username: "renamed-cashier" })
    const otherId = randomUUID()
    await createCollectionItem("users", { id: otherId, username: "permissions-cashier", password, role: "operador", accessProfile: "caixa", fullName: "Outro caixa" }, await actor("permissions-admin"))
    const response = await issueSession({ id: otherId, username: "permissions-cashier", role: "operador" })
    const other = await requireSession(new NextRequest("http://localhost:3002", { headers: { cookie: response.headers.get("set-cookie")!.split(";")[0] } }))
    await expect(executeOperation(other, randomUUID(), "cash-close", { sessionId: cash.id, physicalValue: 0 })).rejects.toMatchObject({ status: 403 })
    expect(await executeOperation(await actor(cashier.id), randomUUID(), "cash-close", { sessionId: cash.id, physicalValue: 0 })).toHaveProperty("status", "fechado")
    await editUser(otherId, { username: `example-${otherId}`, active: false })
    await editUser(cashier.id, { username: "permissions-cashier" })
  })
  it("tentativas inválidas de outra conta não bloqueiam login válido", async () => {
    for (let i = 0; i < 10; i++) await expect(authenticate("missing-account", "wrong")).rejects.toMatchObject({ status: 401 })
    await expect(authenticate("permissions-admin", password)).resolves.toMatchObject({ id: "permissions-admin" })
  }, 15000)
  it("reenvio de operação concluída verifica os acessos atuais e a sessão", async () => {
    const id = randomUUID(), payload = sale()
    await approve("permissions-cashier", id, payload)
    const staleActor = await actor("permissions-cashier")
    expect((await operation("permissions-cashier", id, payload)).status).toBe(200)
    await editUser("permissions-cashier", { permissionOverrides: { "pos.sell": "deny" } })
    await expect(executeOperation(staleActor, id, "sale", payload)).rejects.toMatchObject({ status: 403 })
    await editUser("permissions-cashier", { permissionOverrides: {} })
    await prisma.authSession.delete({ where: { id: staleActor.sessionId } })
    await expect(executeOperation(staleActor, id, "sale", payload)).rejects.toMatchObject({ status: 401 })
  })
  it("restauração exige acesso, preserva identidades, audita e encerra todas as sessões", async () => {
    const backup = JSON.parse(await exportAllCollections())
    const usersBefore = await prisma.user.findMany({ select: { id: true }, orderBy: { id: "asc" } })
    expect((await importRoute(request("permissions-stock", "/api/data/import", backup))).status).toBe(403)
    expect(await prisma.authSession.count()).toBeGreaterThan(0)
    expect((await importRoute(request("permissions-admin", "/api/data/import", backup))).status).toBe(200)
    expect(await prisma.user.findMany({ select: { id: true }, orderBy: { id: "asc" } })).toEqual(usersBefore)
    expect(await prisma.authSession.count()).toBe(0)
    expect(await prisma.userSession.count({ where: { logoutTime: null } })).toBe(0)
    expect(await prisma.operationApproval.count()).toBe(0)
    expect(await prisma.auditEntry.findFirst({ where: { action: "Dados restaurados", user: "permissions-admin" } })).not.toBeNull()
    await expect(actor("permissions-admin")).rejects.toMatchObject({ status: 401 })
  })
})
