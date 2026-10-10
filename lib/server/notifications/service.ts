import { ruleSchema } from "@/lib/notification-policy"
import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { ALL_PERMISSIONS, effectivePermissions } from "@/lib/permissions"
import type { Actor } from "../auth"
import type { NotificationType, NotificationPriority } from "@/lib/types/notifications"

type Tx = Prisma.TransactionClient
export type EventInput = { dedupKey: string; type: NotificationType; title: string; message: string; module: string; requiredPermissions: string[]; reference?: string; priority?: NotificationPriority; actorId?: string; conditionKey?: string }
export async function emitEvent(tx: Tx, input: EventInput) {
  if (!input.requiredPermissions.length || input.requiredPermissions.some(key => !ALL_PERMISSIONS.includes(key))) throw new Error("Permissões de notificação inválidas")
  const previous = await tx.notificationEvent.findUnique({ where: { dedupKey: input.dedupKey } })
  if (previous) return previous
  const event = await tx.notificationEvent.create({ data: input })
  const users = await tx.user.findMany({ where: { active: true }, select: { id: true, role: true, accessProfile: true, permissionOverrides: true } })
  const recipients = users.filter(user => input.requiredPermissions.every(key => effectivePermissions(user).includes(key)))
  if (recipients.length) await tx.userNotification.createMany({ data: recipients.map(user => ({ userId: user.id, eventId: event.id })) })
  return event
}

// Explicit operation catalog: no inference from audit text or client supplied messages.
const catalog: Record<string, { type: NotificationType; title: string; module: string; permissions: string[] }> = {
  reserve: { type: "reservation", title: "Reserva criada", module: "reservas", permissions: ["reservations.read"] },
  "reserve-group": { type: "reservation", title: "Reservas em grupo criadas", module: "reservas", permissions: ["reservations.read"] },
  "edit-reservation": { type: "reservation", title: "Reserva alterada", module: "reservas", permissions: ["reservations.read"] },
  "cancel-reservation": { type: "reservation", title: "Reserva cancelada", module: "reservas", permissions: ["reservations.read"] },
  "reservation-discount": { type: "reservation", title: "Desconto aplicado à reserva", module: "reservas", permissions: ["reservations.read"] },
  "check-in": { type: "check-in", title: "Check-in confirmado", module: "mapa", permissions: ["rooms.read", "reservations.read"] },
  "check-out": { type: "check-out", title: "Check-out confirmado", module: "mapa", permissions: ["rooms.read", "reservations.read"] },
  "stay-checkout": { type: "check-out", title: "Saída de hospedagem confirmada", module: "reservas", permissions: ["stays.read"] },
  "stay-transfer": { type: "reservation", title: "Troca de quarto confirmada", module: "reservas", permissions: ["stays.read"] },
  "stay-occupants": { type: "reservation", title: "Ocupantes atualizados", module: "reservas", permissions: ["stays.read"] },
  "stay-receive": { type: "payment", title: "Recebimento de hospedagem confirmado", module: "reservas", permissions: ["stays.read", "transactions.read"] },
  "release-room": { type: "cleaning", title: "Quarto liberado", module: "mapa", permissions: ["rooms.read"] },
  "pay-reservation": { type: "payment", title: "Pagamento de hospedagem confirmado", module: "reservas", permissions: ["reservations.read", "transactions.read"] },
  "add-consumption": { type: "payment", title: "Consumo registrado", module: "mapa", permissions: ["rooms.read", "consumptions.read"] },
  "remove-consumption": { type: "payment", title: "Consumo removido", module: "mapa", permissions: ["rooms.read", "consumptions.read"] },
  "pay-consumption": { type: "payment", title: "Pagamento de consumo confirmado", module: "mapa", permissions: ["rooms.read", "consumptions.read", "transactions.read"] },
  sale: { type: "pos", title: "Venda confirmada", module: "pdv", permissions: ["posSales.read"] },
  "cancel-sale": { type: "pos", title: "Venda estornada", module: "pdv", permissions: ["posSales.read"] },
  "open-table": { type: "restaurant", title: "Comanda aberta", module: "restaurante", permissions: ["restaurantOrders.read"] },
  "edit-order": { type: "restaurant", title: "Comanda atualizada", module: "restaurante", permissions: ["restaurantOrders.read"] },
  "close-order": { type: "restaurant", title: "Comanda recebida", module: "restaurante", permissions: ["restaurantOrders.read", "transactions.read"] },
  "cancel-order": { type: "restaurant", title: "Comanda cancelada", module: "restaurante", permissions: ["restaurantOrders.read"] },
  production: { type: "production", title: "Produção registrada", module: "estoque", permissions: ["productions.read"] },
  "cash-close": { type: "cash", title: "Caixa fechado", module: "financeiro", permissions: ["cashCloses.read"] },
  "receive-account": { type: "payment", title: "Recebimento confirmado", module: "financeiro", permissions: ["accountsReceivable.read", "transactions.read"] },
  "pay-expense": { type: "payment", title: "Despesa paga", module: "financeiro", permissions: ["expenses.read", "transactions.read"] },
  "refund-transaction": { type: "payment", title: "Receita estornada", module: "financeiro", permissions: ["transactions.read"] },
}
export async function emitOperation(tx: Tx, actor: Actor, requestId: string, kind: string, payload: unknown, result: unknown) {
  const rules = ruleSchema.parse((await tx.systemSettings.findFirst())?.notificationRules ?? {})
  const entry = catalog[kind]
  if (!entry) return
  const input = payload as Record<string, unknown>
  const output = result as Record<string, unknown> | null
  const reference = String(input.stayId ?? input.roomId ?? input.reservationId ?? input.orderId ?? input.saleId ?? output?.id ?? "")
  await emitEvent(tx, { dedupKey: `${actor.id}:${requestId}:${kind}`, type: entry.type, title: entry.title,
    message: "Operação concluída. Consulte os detalhes no módulo correspondente.", module: entry.module,
    requiredPermissions: entry.permissions, reference, actorId: actor.id })
  if (kind === "cash-close" && output && Math.abs(Number(output.divergence)) >= rules.cashDifferenceWarning) await emitEvent(tx, {
    dedupKey: `${actor.id}:${requestId}:cash-difference`, type: "cash", title: "Diferença no fechamento do caixa",
    message: "O fechamento apresenta divergência e precisa de conferência.", module: "financeiro", requiredPermissions: ["cashCloses.read"],
    priority: Math.abs(Number(output.divergence)) >= rules.cashDifferenceCritical ? "critical" : "high", reference, actorId: actor.id })
  if (kind === "production" && output && Number(output.yield) < rules.yieldWarningPercentage) await emitEvent(tx, {
    dedupKey: `${actor.id}:${requestId}:yield`, type: "production", title: "Rendimento abaixo do esperado",
    message: "Confira o rendimento da produção registrada.", module: "estoque", requiredPermissions: ["productions.read"],
    priority: Number(output.yield) < rules.yieldCriticalPercentage ? "critical" : "high", reference, actorId: actor.id })
}
export async function roomStatusEvent(tx: Tx, actor: Actor | undefined, id: string, before: unknown, after: unknown) {
  if (!actor || before === after) return
  await emitEvent(tx, { dedupKey: randomUUID(), type: "cleaning", title: after === "bloqueado" ? "Quarto bloqueado" : "Status do quarto atualizado",
    message: "Consulte a situação atual do quarto no mapa.", module: "mapa", reference: id, actorId: actor.id, requiredPermissions: ["rooms.read"] })
}
