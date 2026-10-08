import { prisma } from "../lib/db/client"
import { Prisma } from "@prisma/client"
import { evaluateStock, evaluateTimed } from "../lib/server/notifications/rules"
import { writeFileSync } from "node:fs"
let stopping = false
process.on("SIGTERM", () => { stopping = true })
process.on("SIGINT", () => { stopping = true })
async function tick() {
  try {
    const worked = await prisma.$transaction(async tx => {
      const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(8040815) AS locked`
      if (!lock.locked) return false
      await evaluateStock(tx); await evaluateTimed(tx)
      const expired = await tx.notificationEvent.findMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86400000) }, OR: [{ priority: { not: "critical" } }, { resolvedAt: { not: null } }] }, select: { id: true }, take: 500 })
      await tx.notificationEvent.deleteMany({ where: { id: { in: expired.map(event => event.id) } } })
      await tx.notificationWorkerState.upsert({ where: { id: "rules" }, create: { id: "rules", lastSuccess: new Date() }, update: { lastSuccess: new Date(), lastError: null } })
      return true
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 })
    if (worked) writeFileSync("/tmp/notification-worker-success", String(Date.now()))
  } catch (error) {
    console.error("Falha ao avaliar notificações", error instanceof Error ? error.message : "Erro desconhecido")
    await prisma.notificationWorkerState.upsert({ where: { id: "rules" }, create: { id: "rules", lastError: "Falha na avaliação; nova tentativa em 30 segundos" }, update: { lastError: "Falha na avaliação; nova tentativa em 30 segundos" } }).catch(() => {})
  }
}
async function main() {
  while (!stopping) { await tick(); if (!stopping) await new Promise(resolve => setTimeout(resolve, 30000)) }
  await prisma.$disconnect()
}
void main()
