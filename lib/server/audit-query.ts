import type { AuditEntry } from "@/lib/store"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/client"
import type { Actor } from "./auth"
import { demand } from "./permissions"
import { getCollectionMapper } from "./db/mappers"
import { HttpError } from "./http"

export const auditQuerySchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), search: z.string().trim().max(200).default(""), user: z.string().max(200).optional(), operation: z.enum(["create", "update", "delete", "action"]).optional(), entityType: z.string().max(100).optional(), from: z.string().date().optional(), to: z.string().date().optional() })
export function auditWhere(input: z.infer<typeof auditQuerySchema>): Prisma.AuditEntryWhereInput {
  if (input.from && input.to && input.from > input.to) throw new HttpError(400, "Período inválido")
  const until = input.to ? new Date(`${input.to}T00:00:00-03:00`) : undefined
  if (until) until.setUTCDate(until.getUTCDate() + 1)
  return { user: input.user, operation: input.operation, entityType: input.entityType, date: input.from || until ? { gte: input.from ? new Date(`${input.from}T00:00:00-03:00`) : undefined, lt: until } : undefined, OR: input.search ? ["action", "reference", "user"].map(field => ({ [field]: { contains: input.search, mode: "insensitive" } })) : undefined }
}
export async function listAudit(actor: Actor, params: URLSearchParams) {
  demand(actor, "auditLog.read")
  const input = auditQuerySchema.parse(Object.fromEntries(params))
  const where = auditWhere(input)
  return prisma.$transaction(async tx => {
    const rows = await tx.auditEntry.findMany({ where, orderBy: [{ date: "desc" }, { id: "desc" }], skip: (input.page - 1) * 50, take: 50 })
    const total = await tx.auditEntry.count({ where })
    const users = await tx.auditEntry.groupBy({ by: ["user"], orderBy: { user: "asc" } })
    const types = await tx.auditEntry.groupBy({ where: { entityType: { not: null } }, by: ["entityType"], orderBy: { entityType: "asc" } })
    return { entries: rows.map(row => getCollectionMapper("auditLog")!.toApp(row) as AuditEntry), total, users: users.map(row => row.user), entityTypes: types.map(row => row.entityType) }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
}
