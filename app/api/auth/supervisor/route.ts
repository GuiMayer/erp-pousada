import { recordAudit } from "@/lib/server/audit"
import { approvalResourceHash } from "@/lib/server/approval-scope"
import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db/client"
import { authorize, hashToken, limitAuthentication } from "@/lib/server/auth"
import { DELEGATABLE, demandOperation } from "@/lib/server/permissions"
import { effectivePermissions } from "@/lib/permissions"
import { handleRoute, HttpError, readJson } from "@/lib/server/http"
const scopes: Record<string, string[]> = {
  sale: ["discount.override"], "edit-reservation": ["discount.override"], "reservation-discount": ["discount.override"],
  "close-order": ["discount.override"], "edit-order": ["discount.override"], "cancel-sale": ["pos.refund"],
  "cancel-order": ["restaurant.cancel"], "remove-consumption": ["consumptions.remove"],
  "refund-transaction": ["transactions.refund"], "cancel-reservation": ["reservations.paidCancel"],
}
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await authorize(request)
    await limitAuthentication(`approval:${actor.id}`)
    const input = z.object({ username: z.string().trim().min(1).max(200).transform(value => value.toLowerCase()), password: z.string().min(1).max(128), requestId: z.string().uuid(), kind: z.string().max(50), payload: z.unknown(), permission: z.string(), resourceHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(await readJson(request))
    if (!DELEGATABLE.includes(input.permission) || !scopes[input.kind]?.includes(input.permission) || actor.permissionOverrides?.[input.permission] === "deny") throw new HttpError(403, "Esta ação não permite aprovação temporária")
    demandOperation({ ...actor, grantedPermissions: [input.permission] }, input.kind)
    const approver = await prisma.user.findUnique({ where: { username: input.username } })
    if (!approver?.active || !await bcrypt.compare(input.password, approver.password)) throw new HttpError(401, "Credenciais do responsável inválidas")
    const permissions = effectivePermissions(approver)
    if (!permissions.includes("approvals.issue") || !permissions.includes(input.permission)) throw new HttpError(403, "Responsável sem permissão para aprovar esta ação")
    await prisma.$transaction(async tx => {
      const responsible = await tx.user.findUnique({ where: { id: approver.id } })
      const executor = await tx.user.findUnique({ where: { id: actor.id } })
      const session = await tx.authSession.findUnique({ where: { id: actor.sessionId } })
      if (!executor?.active || !session || session.expiresAt <= new Date()) throw new HttpError(401, "Sessão expirada")
      if (!responsible?.active || responsible.accessVersion !== approver.accessVersion) throw new HttpError(403, "Acesso do responsável mudou; tente novamente")
      if ((executor.permissionOverrides as Record<string, unknown>)?.[input.permission] === "deny") throw new HttpError(403, "Permissão bloqueada para este usuário")
      demandOperation({ ...actor, permissions: effectivePermissions(executor), grantedPermissions: [input.permission] }, input.kind)
      if (input.resourceHash !== await approvalResourceHash(tx, input.kind, input.payload)) throw new HttpError(409, "Os valores mudaram. Feche esta aprovação e solicite novamente.")
      await tx.operationApproval.create({ data: { requesterId: actor.id, sessionId: actor.sessionId, approverId: approver.id, approverVersion: approver.accessVersion, requestId: input.requestId, requestHash: hashToken(JSON.stringify({ kind: input.kind, payload: input.payload })), resourceHash: await approvalResourceHash(tx, input.kind, input.payload), permission: input.permission, expiresAt: new Date(Date.now() + 2 * 60_000) } })
      await recordAudit(tx, { ...actor, username: approver.username }, "Autorização por operação emitida", input.kind, { entityType: "operationApprovals", entityId: input.requestId, operation: "create", metadata: { executorId: actor.id, approverId: approver.id, permission: input.permission } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    await prisma.authRateLimit.deleteMany({ where: { id: hashToken(`approval:${actor.id}`) } })
    return NextResponse.json({ success: true })
  }, request)
}
