import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import { Client } from "pg"
import { prisma } from "@/lib/db/client"
import { updateCollectionItem, deleteCollectionItem } from "@/lib/server/db/relational-data-service"
import { executeOperation } from "@/lib/server/operations"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import { NextRequest } from "next/server"
import { GET as syncRoute } from "@/app/api/sync/events/route"
import { hashToken } from "@/lib/server/auth"
import type { Actor } from "@/lib/server/auth"

if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw new Error("Somente erp_test")
const fixture = `concurrency-${randomUUID()}`
const actors: Actor[] = []
beforeAll(async () => {
  for (let index = 0; index < 2; index++) {
    const id = `${fixture}-${index}`
    await prisma.user.create({ data: { id, username: id, password: "test-only", fullName: "Usuário fictício", role: "supervisor", active: true, createdBy: "test" } })
    const session = await prisma.authSession.create({ data: { userId: id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) } })
    actors.push({ id, username: id, role: "supervisor", sessionId: session.id, approvedUntil: null, permissions: ALL_PERMISSIONS })
  }
})
afterAll(async () => { await prisma.costCenter.deleteMany({ where: { id: { startsWith: fixture } } }); await prisma.user.deleteMany({ where: { id: { startsWith: fixture } } }); await prisma.$disconnect() })

describe("Concorrência em PostgreSQL real", () => {
  it("duas sessões com a mesma versão não sobrescrevem a edição vencedora", async () => {
    const id = `${fixture}-edit`
    const original = await prisma.costCenter.create({ data: { id, name: "Original", active: true } })
    // Both forms are opened before either user saves (the stale-form barrier).
    const inputs = actors.map((_, index) => ({ name: `Usuário ${index}`, recordVersion: original.recordVersion }))
    const results = await Promise.allSettled(actors.map((actor, index) => updateCollectionItem("costCenters", id, inputs[index], actor)))
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
    const final = await prisma.costCenter.findUniqueOrThrow({ where: { id } })
    const winner = results.findIndex(result => result.status === "fulfilled")
    expect(final.name).toBe(inputs[winner].name)
    expect(final.recordVersion).toBeGreaterThan(original.recordVersion)
    await expect(updateCollectionItem("costCenters", id, inputs[1 - winner], actors[1 - winner])).rejects.toMatchObject({ status: 409, details: { code: "STALE_VERSION" } })
  })
  it("PATCH não limpa campos omitidos e exclusão exige a versão confirmada", async () => {
    const id = `${fixture}-delete`
    const initial = await prisma.costCenter.create({ data: { id, name: "Preservado", description: "Não apagar", active: true } })
    await updateCollectionItem("costCenters", id, { active: false, recordVersion: initial.recordVersion }, actors[0])
    expect((await prisma.costCenter.findUniqueOrThrow({ where: { id } })).description).toBe("Não apagar")
    await expect(deleteCollectionItem("costCenters", id, undefined, actors[1], initial.recordVersion)).rejects.toMatchObject({ status: 409 })
    await expect(deleteCollectionItem("costCenters", id, undefined, actors[1])).rejects.toMatchObject({ status: 428 })
    const current = await prisma.costCenter.findUniqueOrThrow({ where: { id } })
    await deleteCollectionItem("costCenters", id, undefined, actors[1], current.recordVersion)
    expect(await prisma.costCenter.findUnique({ where: { id } })).toBeNull()
  })
  it("escrita de domínio incrementa versão e invalida formulário anterior", async () => {
    const id = `${fixture}-direct`
    const original = await prisma.costCenter.create({ data: { id, name: "Antes", active: true } })
    await prisma.costCenter.update({ where: { id }, data: { description: "Escrita por outro fluxo" } })
    await expect(updateCollectionItem("costCenters", id, { name: "Rascunho", recordVersion: original.recordVersion }, actors[0])).rejects.toMatchObject({ details: { code: "STALE_VERSION" } })
  })
  it("reenvio simultâneo de criação tem um único efeito e resultado", async () => {
    const requestId = randomUUID()
    const id = `${fixture}-receipt`
    const payload = { key: "costCenters", data: { id, name: "Uma criação", active: true } }
    const results = await Promise.all([executeOperation(actors[0], requestId, "admin-create", payload), executeOperation(actors[0], requestId, "admin-create", payload)])
    expect(results[0]).toEqual(results[1])
    expect(await prisma.costCenter.count({ where: { id } })).toBe(1)
  })
  it("avisos não publicam dados pessoais e são entregues somente após commit", async () => {
    const listener = new Client({ connectionString: process.env.DATABASE_URL })
    const writer = new Client({ connectionString: process.env.DATABASE_URL })
    await listener.connect(); await writer.connect()
    const received: string[] = []
    listener.on("notification", message => received.push(message.payload || ""))
    await listener.query("LISTEN erp_sync")
    const id = `${fixture}-notify`
    try {
      await writer.query("BEGIN")
      await writer.query('INSERT INTO cost_centers(id,name,active) VALUES ($1,$2,true)', [id, "Conteúdo privado fictício"])
      expect(received).toEqual([])
      await writer.query("ROLLBACK")
      await writer.query('INSERT INTO cost_centers(id,name,active) VALUES ($1,$2,true)', [id, "Conteúdo privado fictício"])
      await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Aviso não recebido")), 2000); listener.once("notification", () => { clearTimeout(timer); resolve() }); if (received.length) { clearTimeout(timer); resolve() } })
      expect(received).toEqual(["costCenters"])
    } finally { await writer.end(); await listener.end() }
  })
  it("SSE autentica, filtra acesso e atende dez leitores com uma conexão de escuta", async () => {
    expect((await syncRoute(new NextRequest("http://localhost/api/sync/events"))).status).toBe(401)
    const token = randomUUID().replaceAll("-", "").repeat(2)
    await prisma.user.update({ where: { id: actors[1].id }, data: { accessProfile: "personalizado", permissionOverrides: { "costCenters.read": "allow" } } })
    await prisma.authSession.update({ where: { id: actors[1].sessionId }, data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60000) } })
    const request = () => new NextRequest("http://localhost/api/sync/events", { headers: { cookie: `erp_session=${token}` } })
    process.env.SYNC_EVENTS_ENABLED = "false"
    expect((await syncRoute(request())).status).toBe(204)
    delete process.env.SYNC_EVENTS_ENABLED
    const responses = await Promise.all(Array.from({ length: 10 }, () => syncRoute(request())))
    const readers = responses.map(response => response.body!.getReader())
    const writer = new Client({ connectionString: process.env.DATABASE_URL })
    await writer.connect()
    try {
      for (const reader of readers) expect(new TextDecoder().decode((await reader.read()).value)).toContain("reconnected")
      let count = 0
      for (let attempt = 0; attempt < 30; attempt++) {
        count = Number((await writer.query("SELECT count(*) FROM pg_stat_activity WHERE application_name='erp-sync' AND state='idle'")).rows[0].count)
        if (count === 1) break
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      expect(count).toBe(1)
      await writer.query("SELECT pg_notify('erp_sync', 'users'), pg_notify('erp_sync', 'costCenters')")
      for (const reader of readers) {
        let notice = ""
        for (let attempt = 0; attempt < 3 && !notice.includes("costCenters"); attempt++) {
          const chunk = await reader.read()
          expect(chunk.done).toBe(false)
          notice += new TextDecoder().decode(chunk.value)
        }
        expect(notice).toContain("costCenters")
        expect(notice).not.toContain('"users"')
      }
      await writer.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='erp-sync'")
      const resumed = new TextDecoder().decode((await readers[0].read()).value)
      expect(resumed).toContain("reconnected")
      await prisma.authSession.update({ where: { id: actors[1].sessionId }, data: { expiresAt: new Date(0) } })
      // Drain the reconnection notice for the remaining readers before asserting closure.
      for (const reader of readers.slice(1)) expect(new TextDecoder().decode((await reader.read()).value)).toContain("reconnected")
      expect((await readers[0].read()).done).toBe(true)
    } finally { await Promise.all(readers.map(reader => reader.cancel())); await writer.end() }
  }, 15000)
  it("manutenção bloqueia escritas até encerrar sua transação", async () => {
    const maintainer = new Client({ connectionString: process.env.DATABASE_URL })
    const writer = new Client({ connectionString: process.env.DATABASE_URL })
    await maintainer.connect(); await writer.connect()
    let completed = false
    try {
      await maintainer.query("BEGIN")
      await maintainer.query("SELECT pg_advisory_xact_lock(74192026)")
      const write = writer.query('INSERT INTO cost_centers(id,name,active) VALUES ($1,$2,true)', [`${fixture}-maintenance`, "Após manutenção"]).then(() => { completed = true })
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(completed).toBe(false)
      await maintainer.query("COMMIT")
      await write
      expect(completed).toBe(true)
    } finally { await maintainer.query("ROLLBACK"); await maintainer.end(); await writer.end() }
  })

})
