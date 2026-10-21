import { beforeEach, afterAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { executeOperation } from "@/lib/server/operations"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import { businessDay } from "@/lib/utils/business-values"
import type { Actor } from "@/lib/server/auth"

if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw new Error("Use apenas erp_test")
const day = (offset: number) => { const d = new Date(businessDay() + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10) }
let actor: Actor
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "customers", "rooms", "users", "system_settings", "bank_accounts" CASCADE')
  const user = await prisma.user.create({ data: { id: "booking-actor", username: "booking-actor", fullName: "Teste", role: "supervisor", password: "test-only", createdBy: "test" } })
  const session = await prisma.authSession.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 600000) } })
  actor = { id: user.id, username: user.username, role: "supervisor", sessionId: session.id, approvedUntil: null, permissions: ALL_PERMISSIONS }
  await prisma.customer.createMany({ data: [
    { id: "person", name: "Pessoa", cpfCnpj: "52998224725", roles: ["guest", "payer"], active: true },
    { id: "company", name: "Empresa", cpfCnpj: "11222333000181", roles: ["payer"], active: true },
  ] })
  await prisma.guestProfile.create({ data: { cpf: "52998224725", customerId: "person", name: "Pessoa", totalStays: 0, avgTicket: 0, noShows: 0 } })
  await prisma.room.create({ data: { id: 1, number: "101", type: "Standard", capacity: 2, status: "disponivel", timeline: [] } })
  await prisma.lodgingTariff.create({ data: { id: "tariff", name: "Padrão", roomType: "Standard", minGuests: 1, maxGuests: 2, pricePerPerson: 100, validFrom: new Date(day(-365)), active: true } })
  await prisma.bankAccount.create({ data: { id: "bank", name: "Conta", bank: "Banco", type: "corrente", initialBalance: 1000, currentBalance: 1000, active: true } })
})
afterAll(() => prisma.$disconnect())
const payload = (start = 0, end = 2) => ({ roomId: 1, cpf: "52998224725", guestName: "Pessoa", guestCount: 1, payerId: "person", checkIn: day(start), checkOut: day(end), totalValue: (end - start) * 100 })
const op = (kind: string, input: unknown, a = actor) => executeOperation(a, randomUUID(), kind, input)
async function reservePaid(value = 100) {
  const reservation = await op("reserve", payload()) as { id: string }
  if (value) await op("pay-reservation", { reservationId: reservation.id, value, paymentMethod: "pix", accountId: "bank" })
  return prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } })
}

describe("Atendimento de reservas, entradas e cancelamentos", () => {
  it("recusa entrada futura antes de qualquer escrita", async () => {
    await expect(op("check-in", payload(1, 3))).rejects.toMatchObject({ status: 400 })
    expect(await prisma.reservation.count()).toBe(0)
    expect(await prisma.stay.count()).toBe(0)
  })
  it("registra chegada anterior com motivo sem falsificar o instante de registro", async () => {
    await expect(op("check-in", payload(-1, 1))).rejects.toMatchObject({ status: 400 })
    await op("check-in", { ...payload(-1, 1), reason: "Entrada não registrada ontem" })
    const stay = await prisma.stay.findFirstOrThrow()
    expect(stay.checkIn.toISOString().slice(0, 10)).toBe(day(-1))
    expect(businessDay(stay.recordedAt)).toBe(day(0))
    expect(stay.arrivalReason).toBe("Entrada não registrada ontem")
  })
  it("reserva anterior é atendida por ID com chegada real hoje e acordo confirmado", async () => {
    const r = await op("reserve", payload(-1, 1)) as { id: string; recordVersion: number }
    const entry = { ...payload(-1, 1), reservationId: r.id, recordVersion: r.recordVersion, checkIn: day(0) }
    await expect(op("check-in", entry)).rejects.toMatchObject({ status: 409 })
    await op("check-in", { ...entry, keepAgreedPrice: true })
    const stay = await prisma.stay.findFirstOrThrow()
    expect(stay.checkIn.toISOString().slice(0, 10)).toBe(day(0))
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).checkIn.toISOString().slice(0, 10)).toBe(day(-1))
    expect(stay.nightlyPrices).toMatchObject([{ date: day(0), total: 200 }])
  })
  it("hospedagem encerrada retroativa não altera ocupante atual e recebe na data real", async () => {
    await prisma.room.update({ where: { id: 1 }, data: { status: "ocupado", guest: "Outro hóspede" } })
    await op("record-completed-stay", { ...payload(-5, -3), reason: "Hospedagem esquecida na semana", initialPayment: { value: 200, paymentMethod: "pix", accountId: "bank" } })
    expect(await prisma.room.findUnique({ where: { id: 1 } })).toMatchObject({ status: "ocupado", guest: "Outro hóspede" })
    const stay = await prisma.stay.findFirstOrThrow()
    expect(stay.status).toBe("closed")
    expect(businessDay(stay.endedAt!)).toBe(day(-3))
    expect(businessDay((await prisma.transaction.findFirstOrThrow()).date)).toBe(day(0))
    await expect(op("record-completed-stay", { ...payload(-4, -2), reason: "Outro registro conflitante" })).rejects.toMatchObject({ status: 409 })
  })
  it("falha no recebimento integrado reverte entrada, reserva e saldo", async () => {
    await expect(op("check-in", { ...payload(), initialPayment: { value: 100, paymentMethod: "pix", accountId: "missing" } })).rejects.toBeDefined()
    expect(await prisma.stay.count()).toBe(0)
    expect(await prisma.reservation.count()).toBe(0)
    expect((await prisma.room.findUniqueOrThrow({ where: { id: 1 } })).status).toBe("disponivel")
  })
  it("cancelamento sem sinal aceita motivo vazio ou preenchido", async () => {
    const r = await reservePaid(0)
    await op("cancel-reservation", { reservationId: r.id, decision: "refund", cancellationReason: "   " })
    expect(await prisma.reservation.findUnique({ where: { id: r.id } })).toMatchObject({ status: "cancelada", cancellationReason: null })
    expect(await prisma.transaction.count()).toBe(0)
  })
  it.each([["refund", 100, 0], ["retain", 0, 100], ["refund", 60, 40]] as const)("cancelamento %s devolve %s e retém %s preservando o recebido", async (decision, returned, retained) => {
    const r = await reservePaid()
    await op("cancel-reservation", { reservationId: r.id, recordVersion: r.recordVersion, decision, refundValue: returned, cancellationReason: "Mudança de planos", ...(retained ? { financialReason: "Retenção acordada com o cliente" } : {}) })
    const result = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })
    expect(Number(result.paidValue)).toBe(100)
    expect(Number(result.refundedValue)).toBe(returned)
    expect(Number(result.retainedValue)).toBe(retained)
    expect(result.cancellationReason).toBe("Mudança de planos")
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: "bank" } })).currentBalance)).toBe(1100 - returned)
  })
  it("retenção sem justificativa falha; cancelamentos concorrentes não duplicam reembolso", async () => {
    const r = await reservePaid()
    await expect(op("cancel-reservation", { reservationId: r.id, decision: "retain" })).rejects.toMatchObject({ status: 400 })
    const results = await Promise.allSettled([1, 2].map(() => op("cancel-reservation", { reservationId: r.id, recordVersion: r.recordVersion, decision: "refund" })))
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
    expect(await prisma.transaction.count({ where: { type: "estorno" } })).toBe(1)
  })
  it("no-show considera horário configurado", async () => {
    await prisma.systemSettings.create({ data: { id: "settings", pousadaName: "Pousada", discountCeiling: 5, checkInTime: "23:59", checkOutTime: "12:00" } })
    const r = await reservePaid(0)
    await expect(op("cancel-reservation", { reservationId: r.id, status: "noshow", decision: "refund" })).rejects.toMatchObject({ status: 409 })
    await prisma.systemSettings.update({ where: { id: "settings" }, data: { checkInTime: "00:00" } })
    await op("cancel-reservation", { reservationId: r.id, status: "noshow", decision: "refund" })
  })
})
