import { recordAudit } from "../audit"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/client"
import { ALL_PERMISSIONS, effectivePermissions } from "@/lib/permissions"
import { categoryEnabled, preferenceSchema } from "@/lib/notification-policy"
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/types/notifications"
import type { Actor } from "../auth"
import { HttpError } from "../http"
type Tx = Prisma.TransactionClient
export async function preferences(tx: Tx, userId: string) {
  const record = await tx.notificationPreference.findUnique({ where: { userId } })
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...preferenceSchema.partial().parse(record?.value ?? {}) }
}
async function inboxScope(tx: Tx, actor: Actor) {
  const user = await tx.user.findUnique({ where: { id: actor.id } })
  const session = await tx.authSession.findUnique({ where: { id: actor.sessionId } })
  if (!user?.active || !session || session.userId !== actor.id || session.expiresAt <= new Date()) throw new HttpError(401, "Sessão expirada")
  const allowed = effectivePermissions(user)
  const prefs = await preferences(tx, actor.id)
  const types = ["check-in", "check-out", "payment", "reservation", "cleaning", "pos", "restaurant", "stock", "cash", "production"].filter(type => categoryEnabled(type, prefs))
  const where: Prisma.UserNotificationWhereInput = { userId: actor.id, event: {
    NOT: { requiredPermissions: { hasSome: ALL_PERMISSIONS.filter(key => !allowed.includes(key)) } },
    OR: [{ type: { in: types } }, { priority: "critical", resolvedAt: null }],
  } }
  return { where, prefs }
}
export async function listInbox(actor: Actor, cursor?: { date: string; id: string }, archived = false) {
  return prisma.$transaction(async tx => {
    const { where, prefs } = await inboxScope(tx, actor)
    const visibility: Prisma.UserNotificationWhereInput = archived ? { archivedAt: { not: null }, NOT: { event: { priority: "critical", resolvedAt: null } } } : { OR: [{ archivedAt: null }, { event: { priority: "critical", resolvedAt: null } }] }
    const base = { AND: [where, visibility] }
    const rows = await tx.userNotification.findMany({ where: { AND: [base, ...(cursor ? [{ event: { OR: [{ createdAt: { lt: new Date(cursor.date) } }, { createdAt: new Date(cursor.date), id: { lt: cursor.id } }] } }] : [])] },
      include: { event: true }, orderBy: [{ event: { createdAt: "desc" } }, { event: { id: "desc" } }], take: 31 })
    const critical = archived ? [] : await tx.userNotification.findMany({ where: { AND: [where, { event: { priority: "critical", resolvedAt: null } }] }, include: { event: true }, orderBy: { event: { createdAt: "desc" } } })
    const unreadCount = await tx.userNotification.count({ where: { AND: [where, { readAt: null }, { OR: [{ archivedAt: null }, { event: { priority: "critical", resolvedAt: null } }] }] } })
    const page = rows.slice(0, 30); const last = page.at(-1)
    return { notifications: page.map(row => ({ id: row.id, type: row.event.type, title: row.event.title, message: row.event.message, priority: row.event.priority,
      timestamp: row.event.createdAt, read: !!row.readAt, reference: row.event.reference, module: row.event.module, resolvedAt: row.event.resolvedAt, archived: !!row.archivedAt })),
      activeAlerts: critical.map(row => ({ id: row.id, type: row.event.type, title: row.event.title, message: row.event.message, priority: row.event.priority, timestamp: row.event.createdAt, read: !!row.readAt, reference: row.event.reference, module: row.event.module, resolvedAt: row.event.resolvedAt, archived: !!row.archivedAt })),
      unreadCount, preferences: prefs, nextCursor: rows.length > 30 && last ? { date: last.event.createdAt.toISOString(), id: last.event.id } : null }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
}
export async function changeInbox(actor: Actor, ids: string[], action: "read" | "archive" | "restore" | "resolve") {
  return prisma.$transaction(async tx => {
    const { where } = await inboxScope(tx, actor)
    // Explicit ids form a stable set: notifications committed later are untouched.
    const targets = await tx.userNotification.findMany({ where: { AND: [where, { id: { in: ids } }] }, include: { event: true } })
    if (targets.length !== new Set(ids).size) throw new HttpError(404, "Notificação não encontrada")
    if (action === "resolve") {
      const user = await tx.user.findUniqueOrThrow({ where: { id: actor.id } })
      if (!effectivePermissions(user).includes("approvals.issue") || targets.some(row => row.event.conditionKey || !["cash", "production"].includes(row.event.type))) throw new HttpError(403, "Somente um supervisor pode concluir a conferência deste alerta")
      for (const row of targets) {
        await tx.notificationEvent.update({ where: { id: row.event.id }, data: { resolvedAt: new Date() } })
        await recordAudit(tx, actor, "Alerta conferido e resolvido", row.event.id, { entityType: "notificationEvents", entityId: row.event.id, operation: "update" })
      }
      return
    }
    const eligible = targets.filter(row => action !== "archive" || row.event.priority !== "critical" || row.event.resolvedAt)
    await tx.userNotification.updateMany({ where: { userId: actor.id, id: { in: eligible.map(row => row.id) } }, data: action === "read" ? { readAt: new Date() } : { archivedAt: action === "archive" ? new Date() : null } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
export async function updateInboxPreferences(actor: Actor, value: unknown) {
  const patch = preferenceSchema.partial().parse(value)
  return prisma.$transaction(async tx => {
    await inboxScope(tx, actor)
    const next = { ...await preferences(tx, actor.id), ...patch }
    await tx.notificationPreference.upsert({ where: { userId: actor.id }, create: { userId: actor.id, value: next }, update: { value: next } })
    return next
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
