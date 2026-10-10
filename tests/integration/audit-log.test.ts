import { beforeAll, afterAll, describe, it, expect } from "vitest"
import { prisma } from "@/lib/db/client"
import { recordAudit } from "@/lib/server/audit"
import { listAudit } from "@/lib/server/audit-query"
import type { Actor } from "@/lib/server/auth"
if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw new Error("Use exclusivamente erp_test")
const actor = { id: "audit-stable-user", username: "audit-user", role: "supervisor", permissions: ["auditLog.read"] } as Actor
beforeAll(async () => { await prisma.auditEntry.deleteMany() })
afterAll(async () => { await prisma.auditEntry.deleteMany(); await prisma.$disconnect() })
describe("Histórico persistido", () => {
  it("pagina com ordem estável e preserva horários, filtros e metadados", async () => {
    await prisma.$transaction(async tx => {
      for (let index = 0; index < 61; index++) await recordAudit(tx, actor, "Teste de auditoria", `registro-${index}`, { entityType: "restaurantTables", entityId: String(index), operation: "update", metadata: { approverId: "responsavel", before: { password: "nao-gravar" }, after: { status: "livre" } } })
    })
    const one = await listAudit(actor, new URLSearchParams())
    const two = await listAudit(actor, new URLSearchParams({ page: "2" }))
    expect(one.total).toBe(61); expect(one.entries).toHaveLength(50); expect(two.entries).toHaveLength(11)
    expect(new Set([...one.entries, ...two.entries].map(entry => entry.id)).size).toBe(61)
    expect(one.entries[0].date).toMatch(/T\d{2}:\d{2}:\d{2}/)
    expect(one.entries[0].metadata).toMatchObject({ executorId: actor.id, approverId: "responsavel", before: { password: "[REDACTED]" } })
    const filtered = await listAudit(actor, new URLSearchParams({ search: "registro-60", user: actor.username, operation: "update", entityType: "restaurantTables" }))
    expect(filtered.entries).toHaveLength(1)
    expect((await listAudit(actor, new URLSearchParams({ from: "2000-01-01", to: "2000-01-02" }))).entries).toHaveLength(0)
    await expect(listAudit({ ...actor, permissions: [] }, new URLSearchParams())).rejects.toMatchObject({ status: 403 })
  })
  it("reverte o registro se a transação da operação falhar", async () => {
    await expect(prisma.$transaction(async tx => { await recordAudit(tx, actor, "Rollback", "rollback-example"); throw new Error("Rollback") })).rejects.toThrow("Rollback")
    expect(await prisma.auditEntry.count({ where: { reference: "rollback-example" } })).toBe(0)
  })
})
