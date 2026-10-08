import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import type { Actor } from "./auth"
import { sanitizeForAudit } from "../utils/audit-helpers"
import { logContext } from "./logging"

export async function recordAudit(tx: Prisma.TransactionClient, actor: Actor, action: string, reference: string, detail: { entityType?: string; entityId?: string; operation?: string; metadata?: Record<string, unknown> } = {}) {
  const context = logContext.getStore()
  const metadata = JSON.parse(JSON.stringify(sanitizeForAudit(JSON.parse(JSON.stringify({ ...detail.metadata, executorId: detail.metadata?.executorId ?? actor.id, requestId: context?.requestId, businessOperation: context?.operation }))))) as Prisma.InputJsonValue
  await tx.auditEntry.create({ data: { id: randomUUID(), user: actor.username, action, reference, ...detail, metadata } })
}
