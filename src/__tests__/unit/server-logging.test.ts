import { afterEach, describe, expect, it, vi } from "vitest"
import { getCollectionMapper } from "@/lib/server/db/mappers"
import { applyOperation } from "@/lib/server/operations"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import { Prisma } from "@prisma/client"
import { handleRoute, HttpError } from "@/lib/server/http"
import { beforeEach } from "vitest"
import { recordAudit } from "@/lib/server/audit"
import { logContext, setLogActor } from "@/lib/server/logging"
import { auditQuerySchema, auditWhere, listAudit } from "@/lib/server/audit-query"
beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())
describe("Auditoria e logs do servidor", () => {
  it("preserva o instante completo para a interface", () => {
    const mapped = getCollectionMapper("auditLog")!.toApp({ id: "example", date: new Date("2026-10-08T17:23:45.000Z"), user: "exemplo", action: "Teste", reference: "exemplo" }) as { date: string }
    expect(mapped.date).toBe("2026-10-08T17:23:45.000Z")
  })
  it("negação de acesso gera evento de segurança", async () => {
    const logger = vi.spyOn(console, "warn").mockImplementation(() => {})
    const response = await handleRoute(async () => { throw new HttpError(403, "Acesso negado") }, new Request("http://localhost/api/operations"))
    expect(response.status).toBe(403); expect(JSON.parse(logger.mock.calls[0][0])).toMatchObject({ event: "security.denied", route: "/api/operations", status: 403 })
  })
  it("edição de comanda grava antes/depois e executor na transação", async () => {
    const tx = { auditEntry: { create: vi.fn() }, restaurantOrder: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "example", status: "aberta", version: 0, items: [], subtotal: new Prisma.Decimal(0), discount: new Prisma.Decimal(0), total: new Prisma.Decimal(0) }), update: vi.fn() }, pOSProduct: { findMany: vi.fn().mockResolvedValue([]) }, systemSettings: { findFirst: vi.fn().mockResolvedValue({ discountCeiling: 10 }) }, restaurantOrderItem: { deleteMany: vi.fn() } }
    const actor = { id: "example", username: "exemplo", role: "supervisor" as const, sessionId: "example", approvedUntil: null, permissions: ALL_PERMISSIONS }
    expect(await applyOperation(tx as unknown as Prisma.TransactionClient, actor, "edit-order", { orderId: "example", expectedVersion: 0, items: [] })).toEqual({ success: true })
    expect(tx.restaurantOrder.update).toHaveBeenCalled(); expect(tx.auditEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ entityId: "example", operation: "update", metadata: expect.objectContaining({ executorId: "example", before: expect.objectContaining({ version: 0 }), after: expect.objectContaining({ version: 1 }) }) }) })
  })
  it("alteração de estado da mesa grava auditoria", async () => {
    const tx = { auditEntry: { create: vi.fn() }, restaurantTable: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 1, number: "101", status: "livre" }), update: vi.fn() } }
    const actor = { id: "example", username: "exemplo", role: "supervisor" as const, sessionId: "example", approvedUntil: null, permissions: ALL_PERMISSIONS }
    expect(await applyOperation(tx as unknown as Prisma.TransactionClient, actor, "table-status", { tableId: 1, status: "reservada" })).toEqual({ success: true })
    expect(tx.restaurantTable.update).toHaveBeenCalled(); expect(tx.auditEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ entityId: "1", metadata: expect.objectContaining({ before: { status: "livre" }, after: { status: "reservada" } }) }) })
  })
  it("erro inesperado tem correlação sem expor mensagem ou consulta", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {})
    const response = await handleRoute(async () => { throw new Error("token=exemplo-ficticio") }, new Request("http://localhost/api/operations?token=outro-exemplo"))
    expect(response.status).toBe(500)
    expect(JSON.parse(logger.mock.calls[0][0])).toMatchObject({ event: "request.failed", route: "/api/operations", errorType: "Error", requestId: response.headers.get("X-Request-Id") })
    expect(JSON.stringify(logger.mock.calls)).not.toContain("exemplo")
    expect((await response.json()).error).not.toContain("token")
  })
})

describe("Proteção e consulta do histórico", () => {
  it("sanitiza metadados inclusive senhas aninhadas e CPF", async () => {
    const tx = { auditEntry: { create: vi.fn() } }
    await recordAudit(tx as unknown as Prisma.TransactionClient, { id: "stable-id", username: "novo-nome" } as never, "Teste", "exemplo", { metadata: { before: { password: "segredo", cpf: "12345678900", nested: { tokenHash: "segredo" } }, approverId: "responsavel" } })
    const data = tx.auditEntry.create.mock.calls[0][0].data
    expect(data.metadata.executorId).toBe("stable-id")
    expect(data.metadata.approverId).toBe("responsavel")
    expect(JSON.stringify(data)).not.toContain("segredo")
    expect(JSON.stringify(data)).not.toContain("12345678900")
  })
  it("isola contexto entre requisições concorrentes", async () => {
    const logger = vi.spyOn(console, "warn").mockImplementation(() => {})
    await Promise.all(["one", "two"].map(id => handleRoute(async () => { setLogActor(id); await Promise.resolve(); throw new HttpError(403, "Negado") }, new Request(`http://localhost/api/${id}`))))
    const rows = logger.mock.calls.map(call => JSON.parse(call[0]))
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ route: "/api/one", actorId: "one" }), expect.objectContaining({ route: "/api/two", actorId: "two" })]))
    expect(rows[0].requestId).not.toBe(rows[1].requestId)
    expect(logContext.getStore()).toBeUndefined()
  })
  it("registra falha de login mas não trata sessão expirada como ataque", async () => {
    const logger = vi.spyOn(console, "warn").mockImplementation(() => {})
    await handleRoute(async () => { throw new HttpError(401, "Inválido") }, new Request("http://localhost/api/auth/login"))
    await handleRoute(async () => { throw new HttpError(401, "Expirada") }, new Request("http://localhost/api/auth/session"))
    expect(logger).toHaveBeenCalledTimes(1)
  })
  it("exige permissão antes de consultar o banco", async () => {
    await expect(listAudit({ permissions: [] } as never, new URLSearchParams())).rejects.toMatchObject({ status: 403 })
  })
  it("valida limites de página e período em horário de Brasília", () => {
    expect(auditQuerySchema.safeParse({ page: -1 }).success).toBe(false)
    const where = auditWhere(auditQuerySchema.parse({ from: "2026-10-08", to: "2026-10-08" }))
    expect(where.date).toEqual({ gte: new Date("2026-10-08T03:00:00Z"), lt: new Date("2026-10-09T03:00:00Z") })
    expect(() => auditWhere(auditQuerySchema.parse({ from: "2026-10-09", to: "2026-10-08" }))).toThrow("Período inválido")
  })
})
