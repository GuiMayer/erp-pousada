import { prisma } from "@/lib/db/client"
import { canReadCashStatus } from "@/lib/cash-access"
import { can } from "./permissions"
import type { Actor } from "./auth"
import { HttpError } from "./http"

export async function cashStatus(actor: Actor) {
  if (!canReadCashStatus(permission => can(actor, permission))) throw new HttpError(403, "Sem acesso ao estado do caixa")
  return prisma.$transaction(async tx => {
    const active = await tx.cashClose.findFirst({ where: { status: "aberto" }, select: { id: true, operator: true, responsibleUserId: true, date: true, openedAt: true } })
    const previous = can(actor, "cash.open") ? await tx.cashClose.findFirst({ where: { status: "fechado" }, orderBy: [{ closedAt: "desc" }, { id: "desc" }], select: { id: true, date: true, closedAt: true, retainedValue: true } }) : null
    // Same minimal shape as the cached collection, with no closing balances,
    // transactions or discrepancies. The retained fund is needed only to open.
    return [
      ...(active ? [{ ...active, status: "aberto", physicalValue: 0, expectedValue: 0, divergence: 0 }] : []),
      ...(previous ? [{ ...previous, status: "fechado", operator: "", retainedValue: Number(previous.retainedValue), physicalValue: 0, expectedValue: 0, divergence: 0 }] : []),
    ]
  })
}
