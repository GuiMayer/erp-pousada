import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { emitEvent } from "@/lib/server/notifications/service"
import { listInbox, changeInbox, updateInboxPreferences } from "@/lib/server/notifications/inbox"
import { evaluateStock, evaluateTimed } from "@/lib/server/notifications/rules"
import { executeOperation } from "@/lib/server/operations"
import { effectivePermissions } from "@/lib/permissions"
import type { Actor } from "@/lib/server/auth"
if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw new Error("Use exclusivamente erp_test")
let admin: Actor; let reception: Actor; let stock: Actor
async function user(id: string, profile: string) {
  const u = await prisma.user.create({ data: { id, username: id, password: "not-used", fullName: id, role: "supervisor", accessProfile: profile, createdBy: "test" } })
  const session = await prisma.authSession.create({ data: { userId: id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600000) } })
  return { id, username: id, role: "supervisor" as const, sessionId: session.id, approvedUntil: null, permissions: effectivePermissions(u) }
}
const emit = (key = randomUUID(), priority: "medium" | "critical" = "medium") => prisma.$transaction(tx => emitEvent(tx, { dedupKey: key, type: "reservation", title: "Reserva criada", message: "Exemplo", module: "reservas", requiredPermissions: ["reservations.read"], priority }))
beforeAll(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE users, rooms, product_categories, system_settings, notification_events, operation_receipts CASCADE')
  admin = await user("notif-admin", "administrador"); reception = await user("notif-reception", "recepcao"); stock = await user("notif-stock", "estoque")
  await prisma.systemSettings.create({ data: { id: "notif-settings", pousadaName: "Teste", checkInTime: "14:00", checkOutTime: "12:00", discountCeiling: 10 } })
  await prisma.room.create({ data: { id: 1, number: "101", type: "casal", status: "disponivel" } })
  await prisma.productCategory.create({ data: { id: "notif-category", name: "Teste", color: "blue", icon: "Cup" } })
  await prisma.pOSProduct.create({ data: { id: "notif-product", name: "Água", categoryId: "notif-category", price: 10, trackStock: true } })
  await prisma.stockItem.create({ data: { id: "notif-stock", productId: "notif-product", productName: "Água", currentStock: 20, minimumStock: 10, maximumStock: 100, unit: "un", averageCost: 2, lastPurchasePrice: 2 } })
})
beforeEach(async () => { await prisma.notificationEvent.deleteMany(); await prisma.notificationPreference.deleteMany(); await prisma.user.update({ where: { id: reception.id }, data: { permissionOverrides: {} } }); await prisma.stockItem.update({ where: { id: "notif-stock" }, data: { currentStock: 20 } }) })
afterAll(async () => { await prisma.systemSettings.deleteMany({ where: { id: "notif-settings" } }); await prisma.$disconnect() })
describe("Central operacional persistida", () => {
  it("seleciona destinatários e mantém leitura por usuário", async () => {
    await emit()
    const a = await listInbox(admin); const b = await listInbox(reception)
    expect(a.unreadCount).toBe(1); expect(b.unreadCount).toBe(1); expect((await listInbox(stock)).unreadCount).toBe(0)
    await changeInbox(admin, [a.notifications[0].id], "read")
    expect((await listInbox(admin)).unreadCount).toBe(0); expect((await listInbox(reception)).unreadCount).toBe(1)
    await expect(changeInbox(reception, [a.notifications[0].id], "archive")).rejects.toMatchObject({ status: 404 })
  })
  it("revoga histórico e contadores ao perder permissão", async () => {
    await emit(); const id = (await listInbox(reception)).notifications[0].id
    await prisma.user.update({ where: { id: reception.id }, data: { permissionOverrides: { "reservations.read": "deny" } } })
    expect((await listInbox(reception)).notifications).toHaveLength(0); expect((await listInbox(reception)).unreadCount).toBe(0)
    await expect(changeInbox(reception, [id], "read")).rejects.toMatchObject({ status: 404 })
  })
  it("exige todas as permissões do conteúdo", async () => {
    await prisma.$transaction(tx => emitEvent(tx, { dedupKey: randomUUID(), type: "payment", title: "Pagamento", message: "Teste", module: "reservas", requiredPermissions: ["reservations.read", "transactions.read"] }))
    const current = await prisma.user.findUniqueOrThrow({ where: { id: reception.id } })
    expect((await listInbox(reception)).notifications.length).toBe(effectivePermissions(current).includes("transactions.read") ? 1 : 0)
  })
  it("rollback não grava evento e replay não duplica", async () => {
    await expect(prisma.$transaction(async tx => { await emitEvent(tx, { dedupKey: "rollback", type: "reservation", title: "Teste", message: "Teste", module: "reservas", requiredPermissions: ["reservations.read"] }); throw new Error("rollback") })).rejects.toThrow("rollback")
    expect(await prisma.notificationEvent.count()).toBe(0)
    const id = randomUUID(); await emit(id); await emit(id); expect(await prisma.notificationEvent.count()).toBe(1)
  })
  it("ações coletivas preservam eventos novos e arquivo é reversível", async () => {
    await emit(); const first = (await listInbox(admin)).notifications[0].id
    await emit(); await changeInbox(admin, [first], "read"); expect((await listInbox(admin)).unreadCount).toBe(1)
    await changeInbox(admin, [first], "archive"); expect((await listInbox(admin)).notifications).toHaveLength(1)
    expect((await listInbox(admin, undefined, true)).notifications).toHaveLength(1)
    await changeInbox(admin, [first], "restore"); expect((await listInbox(admin)).notifications).toHaveLength(2)
  })
  it("preferências são individuais e alertas críticos não podem ser ocultados", async () => {
    await emit(); await emit(randomUUID(), "critical")
    await updateInboxPreferences(admin, { enabled: false })
    const inbox = await listInbox(admin); expect(inbox.notifications).toHaveLength(1)
    await changeInbox(admin, [inbox.notifications[0].id], "archive"); expect((await listInbox(admin)).notifications).toHaveLength(1)
    expect((await listInbox(reception)).notifications).toHaveLength(2)
    await expect(updateInboxPreferences(admin, { userId: reception.id })).rejects.toThrow()
  })
  it("estoque deduplica condições, escala criticidade e resolve na reposição", async () => {
    await prisma.stockItem.update({ where: { id: "notif-stock" }, data: { currentStock: 14 } })
    await prisma.$transaction(evaluateStock); await prisma.$transaction(evaluateStock)
    expect(await prisma.notificationEvent.count()).toBe(1)
    await prisma.stockItem.update({ where: { id: "notif-stock" }, data: { currentStock: 5 } }); await prisma.$transaction(evaluateStock)
    expect(await prisma.notificationEvent.count({ where: { conditionKey: "stock:notif-product", priority: "critical" } })).toBe(1)
    await prisma.stockItem.update({ where: { id: "notif-stock" }, data: { currentStock: 20 } }); await prisma.$transaction(evaluateStock)
    expect(await prisma.notificationEvent.count({ where: { resolvedAt: null } })).toBe(0)
    await prisma.stockItem.update({ where: { id: "notif-stock" }, data: { currentStock: 5 } }); await prisma.$transaction(evaluateStock)
    expect(await prisma.notificationEvent.count({ where: { conditionKey: "stock:notif-product" } })).toBe(1)
  })
  it("lembretes respeitam horário de São Paulo e resolução", async () => {
    await prisma.guestProfile.upsert({ where: { cpf: "52998224725" }, create: { cpf: "52998224725", name: "Exemplo" }, update: {} })
    await prisma.reservation.create({ data: { id: "notif-reservation", roomId: 1, roomNumber: "101", guestName: "Exemplo", cpf: "52998224725", checkIn: new Date("2026-10-08"), checkOut: new Date("2026-10-09"), status: "confirmada", totalValue: 100 } })
    await prisma.$transaction(tx => evaluateTimed(tx, new Date("2026-10-08T16:59:00Z"))); expect(await prisma.notificationEvent.count()).toBe(0)
    await prisma.$transaction(tx => evaluateTimed(tx, new Date("2026-10-08T17:00:00Z"))); await prisma.$transaction(tx => evaluateTimed(tx, new Date("2026-10-08T17:01:00Z")))
    expect(await prisma.notificationEvent.count()).toBe(1)
    await prisma.reservation.update({ where: { id: "notif-reservation" }, data: { status: "cancelada" } }); await prisma.$transaction(tx => evaluateTimed(tx, new Date("2026-10-08T17:02:00Z")))
    expect(await prisma.notificationEvent.count({ where: { resolvedAt: null } })).toBe(0)
  })
  it("lembrete de pagamento independe da opção de lembrete de saída", async () => {
    await prisma.systemSettings.update({ where: { id: "notif-settings" }, data: { notifyCheckOutReminder: false, notifyPendingPayments: true } })
    await prisma.reservation.update({ where: { id: "notif-reservation" }, data: { status: "checkin" } })
    await prisma.$transaction(tx => evaluateTimed(tx, new Date("2026-10-09T15:00:00Z")))
    expect(await prisma.notificationEvent.count({ where: { type: "payment" } })).toBe(1)
    expect(await prisma.notificationEvent.count({ where: { type: "check-out" } })).toBe(0)
  })
  it("operação e recibo emitem somente após confirmar e não duplicam no replay", async () => {
    const requestId = randomUUID(); const payload = { productId: "notif-product", type: "ajuste", quantity: 5, reason: "Teste" }
    await executeOperation(admin, requestId, "stock-movement", payload); await executeOperation(admin, requestId, "stock-movement", payload)
    expect(await prisma.stockMovement.count({ where: { reason: "Teste" } })).toBe(1); expect(await prisma.notificationEvent.count({ where: { type: "stock" } })).toBe(1)
  })
  it("pedidos simultâneos com o mesmo recibo emitem uma única venda", async () => {
    const requestId = randomUUID(); const saleId = randomUUID()
    const payload = { sale: { id: saleId, items: [{ id: randomUUID(), product: { id: "notif-product" }, quantity: 1, discount: 0 }], total: 10, amountPaid: 10, paymentMethod: "pix" }, globalDiscount: 0 }
    await Promise.all([executeOperation(admin, requestId, "sale", payload), executeOperation(admin, requestId, "sale", payload)])
    expect(await prisma.notificationEvent.count({ where: { type: "pos", reference: saleId } })).toBe(1)
  })
  it("reserva em grupo produz um aviso e não duplica notificações por quarto", async () => {
    await prisma.room.create({ data: { id: 2, number: "102", type: "casal", status: "disponivel" } })
    await executeOperation(admin, randomUUID(), "reserve-group", { rooms: [{ roomId: 1, totalValue: 100 }, { roomId: 2, totalValue: 100 }], cpf: "52998224725", guestName: "Exemplo", checkIn: "2027-01-01", checkOut: "2027-01-03" })
    expect(await prisma.notificationEvent.count({ where: { type: "reservation" } })).toBe(1)
  })
  it("conferência de alerta crítico exige supervisor e gera auditoria", async () => {
    await prisma.$transaction(tx => emitEvent(tx, { dedupKey: randomUUID(), type: "cash", title: "Diferença", message: "Teste", module: "financeiro", requiredPermissions: ["cashCloses.read"], priority: "critical" }))
    const id = (await listInbox(admin)).notifications[0].id
    await changeInbox(admin, [id], "resolve")
    expect((await listInbox(admin)).notifications[0].resolvedAt).toBeTruthy()
    const notification = await prisma.userNotification.findUniqueOrThrow({ where: { id } })
    expect(await prisma.auditEntry.count({ where: { action: "Alerta conferido e resolvido", reference: notification.eventId } })).toBe(1)
  })
  it("mantém alertas críticos antigos visíveis além da primeira página", async () => {
    const event = await emit(randomUUID(), "critical")
    await prisma.notificationEvent.update({ where: { id: event.id }, data: { createdAt: new Date("2026-01-01") } })
    for (let index = 0; index < 31; index++) await emit()
    const page = await listInbox(admin)
    expect(page.notifications).toHaveLength(30); expect(page.nextCursor).toBeTruthy(); expect(page.activeAlerts).toHaveLength(1)
  })
  it("nova permissão não concede histórico retroativamente", async () => {
    await emit()
    await prisma.user.update({ where: { id: stock.id }, data: { permissionOverrides: { "reservations.read": "allow" } } })
    expect((await listInbox(stock)).notifications).toHaveLength(0)
    await emit(); expect((await listInbox(stock)).notifications).toHaveLength(1)
  })
})
