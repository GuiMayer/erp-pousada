import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { executeOperation } from "@/lib/server/operations"
import { cashStatus } from "@/lib/server/cash-status"
import type { Actor } from "@/lib/server/auth"
import { ALL_PERMISSIONS } from "@/lib/permissions"

if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw Error("Exige erp_test isolado")
let admin: Actor, operator: Actor
const prefix = `cash-${randomUUID()}`
beforeAll(async () => {
  for (const kind of ["admin", "operator"]) {
    const permissions = kind === "admin" ? ALL_PERMISSIONS : ["cash.open", "cash.close"]
    const user = await prisma.user.create({ data: { id: prefix + kind, username: prefix + kind, fullName: kind, password: "test-only", role: kind === "admin" ? "supervisor" : "operador", accessProfile: "personalizado", permissionOverrides: Object.fromEntries(permissions.map(p => [p, "allow"])), createdBy: "test" } })
    const session = await prisma.authSession.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 600000) } })
    const actor: Actor = { id: user.id, username: user.username, role: kind === "admin" ? "supervisor" : "operador", sessionId: session.id, permissions, approvedUntil: null }
    if (kind === "admin") admin = actor; else operator = actor
  }
})
beforeEach(async () => {
  await prisma.$executeRawUnsafe("TRUNCATE transactions, cash_closes, bank_accounts CASCADE")
  await prisma.bankAccount.create({ data: { id: prefix, name: "Conta teste", type: "corrente", active: true, initialBalance: 500, currentBalance: 500 } })
})
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } }); await prisma.$disconnect() })
const op = (kind: string, payload: unknown, actor = admin, request = randomUUID()) => executeOperation(actor, request, kind, payload)
const open = async (value = 100, actor = admin) => await op("cash-open", { openingValue: value }, actor) as { id: string }

describe("Passagem e conferência do caixa", () => {
  it("exige justificativa para diferença, conserva a contagem e registra a conferência separadamente", async () => {
    const turn = await open()
    await expect(op("cash-close", { sessionId: turn.id, physicalValue: 90 })).rejects.toMatchObject({ details: { code: "CASH_DIFFERENCE" } })
    expect((await prisma.cashClose.findUniqueOrThrow({ where: { id: turn.id } })).status).toBe("aberto")
    await op("cash-close", { sessionId: turn.id, physicalValue: 90, retainedValue: 30, closingReason: "Diferença identificada na contagem" })
    const closingNotice = await prisma.notificationEvent.findFirstOrThrow({ where: { reference: turn.id, title: "Caixa fechado" } })
    expect(closingNotice.module).toBe("pdv")
    const key = randomUUID()
    await expect(op("cash-review", { sessionId: turn.id, note: "Contagem conferida" }, operator)).rejects.toMatchObject({ status: 403 })
    await op("cash-review", { sessionId: turn.id, note: "Contagem conferida" }, admin, key)
    await op("cash-review", { sessionId: turn.id, note: "Contagem conferida" }, admin, key)
    const closed = await prisma.cashClose.findUniqueOrThrow({ where: { id: turn.id } })
    expect(Number(closed.expectedValue)).toBe(100)
    expect(Number(closed.divergence)).toBe(-10)
    expect(Number(closed.withdrawnValue)).toBe(60)
    expect(closed.reviewedBy).toBe(admin.username)
    await expect(op("cash-review", { sessionId: turn.id, note: "Outra conferência" })).rejects.toMatchObject({ status: 409 })
  })
  it("liga o fundo ao próximo turno e pede motivo quando o valor muda", async () => {
    const turn = await open()
    await op("cash-close", { sessionId: turn.id, physicalValue: 100, retainedValue: 40 })
    await expect(open(30)).rejects.toMatchObject({ details: { code: "CASH_OPENING_DIFFERENCE" } })
    const next = await op("cash-open", { openingValue: 30, openingReason: "Fundo reduzido pelo supervisor" }) as { previousSessionId: string }
    expect(next.previousSessionId).toBe(turn.id)
    expect(await prisma.transaction.count()).toBe(0)
  })
  it("deposita a retirada uma única vez sem gerar receita, inclusive com sobra na contagem", async () => {
    const turn = await open(100), request = randomUUID()
    const input = { sessionId: turn.id, physicalValue: 110, retainedValue: 5, withdrawalAccountId: prefix, closingReason: "Sobra verificada na contagem" }
    await op("cash-close", input, admin, request); await op("cash-close", input, admin, request)
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: prefix } })).currentBalance)).toBe(605)
    const entries = await prisma.transaction.findMany()
    expect(entries).toHaveLength(1)
    expect(entries[0].type).toBe("transferencia_entrada")
    expect(entries[0].originId).toBe(turn.id)
  })
  it("não fecha nem movimenta saldo quando depósito ou fundo são inválidos", async () => {
    const turn = await open(100, operator)
    await expect(op("cash-close", { sessionId: turn.id, physicalValue: 100, retainedValue: 101 }, operator)).rejects.toMatchObject({ status: 400 })
    await expect(op("cash-close", { sessionId: turn.id, physicalValue: 100, retainedValue: 0, withdrawalAccountId: prefix }, operator)).rejects.toMatchObject({ status: 403 })
    expect((await prisma.cashClose.findUniqueOrThrow({ where: { id: turn.id } })).status).toBe("aberto")
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: prefix } })).currentBalance)).toBe(500)
  })
  it("consulta o estado sem liberar histórico financeiro", async () => {
    const turn = await open(100, operator)
    const state = await cashStatus(operator)
    expect(state[0]).toMatchObject({ id: turn.id, status: "aberto", expectedValue: 0 })
    expect(state[0]).not.toHaveProperty("openingValue")
    await op("cash-close", { sessionId: turn.id, physicalValue: 90, retainedValue: 30, closingReason: "Falta de troco confirmada" }, operator)
    const previous = (await cashStatus(operator))[0]
    expect(previous).toMatchObject({ retainedValue: 30, expectedValue: 0, divergence: 0 })
    expect(previous).not.toHaveProperty("closingReason")
    await expect(cashStatus({ ...operator, permissions: [] })).rejects.toMatchObject({ status: 403 })
  })
  it("mantém apenas um turno em aberturas simultâneas", async () => {
    const results = await Promise.allSettled([open(), open()])
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
    expect(await prisma.cashClose.count({ where: { status: "aberto" } })).toBe(1)
  })
  it("serializa um movimento concorrente ao fechamento sem alterar turno fechado", async () => {
    const turn = await open()
    const results = await Promise.allSettled([
      op("cash-close", { sessionId: turn.id, physicalValue: 100 }),
      op("cash-movement", { direction: "supply", value: 10, accountId: prefix, reason: "Suprimento concorrente" }),
    ])
    expect(results.some(r => r.status === "fulfilled")).toBe(true)
    const current = await prisma.cashClose.findUniqueOrThrow({ where: { id: turn.id } })
    const entries = await prisma.transaction.findMany({ where: { cashSessionId: turn.id } })
    if (current.status === "fechado") { expect(entries).toHaveLength(0); expect(Number(current.expectedValue)).toBe(100) }
    else { expect(entries).toHaveLength(1); expect(Number(entries[0].value)).toBe(10) }
  })
})
