import type { Actor } from "./auth"
import { can } from "./permissions"
import { HttpError } from "./http"
import type { Prisma } from "@prisma/client"
import { createHash } from "node:crypto"
async function reviewResource(tx: Prisma.TransactionClient, kind: string, payload: unknown) {
  const input = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  let resource: unknown = null
  if (kind === "cancel-reservation" && typeof input.reservationId === "string") resource = await tx.reservation.findUnique({ where: { id: input.reservationId } })
  if (kind === "remove-consumption" && typeof input.roomId === "number") resource = await tx.roomConsumption.findUnique({ where: { roomId: input.roomId }, include: { items: true } })
  if (kind === "cancel-sale" && typeof input.saleId === "string") resource = await tx.pOSSale.findUnique({ where: { id: input.saleId } })
  if (kind === "refund-transaction" && typeof input.transactionId === "string") resource = await tx.transaction.findUnique({ where: { id: input.transactionId } })
  if (["cancel-order", "close-order", "edit-order"].includes(kind) && typeof input.orderId === "string") resource = await tx.restaurantOrder.findUnique({ where: { id: input.orderId }, include: { items: true } })
  if (["edit-reservation", "reservation-discount"].includes(kind)) {
    const id = input.reservationId ?? input.id
    if (typeof id === "string") resource = await tx.reservation.findUnique({ where: { id } })
  }
  return resource
}

export async function approvalResourceHash(tx: Prisma.TransactionClient, kind: string, payload: unknown) {
  return createHash("sha256").update(JSON.stringify(await reviewResource(tx, kind, payload))).digest("hex")
}
export async function approvalReview(tx: Prisma.TransactionClient, actor: Actor, kind: string, payload: unknown) {
  const collections: Record<string, string> = { "cancel-sale": "posSales", "cancel-reservation": "reservations", "edit-reservation": "reservations", "reservation-discount": "reservations", "remove-consumption": "consumptions", "refund-transaction": "transactions", "cancel-order": "restaurantOrders", "close-order": "restaurantOrders", "edit-order": "restaurantOrders" }
  if (collections[kind] && !can(actor, `${collections[kind]}.read`)) throw new HttpError(403, "Consulte o responsável; seu usuário não pode visualizar esta operação")
  const resource = await reviewResource(tx, kind, payload) as Record<string, unknown> | null
  const input = payload as Record<string, unknown>
  const summary: { label: string; value: string }[] = []
  const money = (value: unknown) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  const reference = resource?.id ?? input.reservationId ?? input.saleId ?? input.orderId ?? input.transactionId ?? input.roomId
  if (reference) summary.push({ label: "Referência", value: String(reference) })
  const total = resource?.totalValue ?? resource?.total ?? resource?.value ?? (input.sale as Record<string, unknown> | undefined)?.total ?? input.totalValue
  if (total !== undefined) summary.push({ label: "Valor atual", value: money(total) })
  if (resource?.paidValue !== undefined) summary.push({ label: "Recebido", value: money(resource.paidValue) })
  if (input.globalDiscount !== undefined || input.discountPercent !== undefined) summary.push({ label: "Desconto solicitado", value: `${input.globalDiscount ?? input.discountPercent}%` })
  if (input.fee !== undefined) summary.push({ label: "Multa", value: money(input.fee) })
  if (input.treatment !== undefined) summary.push({ label: "Tratativa", value: ({ estorno: "Reembolso", multa: "Retenção de multa", credito: "Crédito para próxima estadia" } as Record<string, string>)[String(input.treatment)] ?? String(input.treatment) })
  if (input.reason) summary.push({ label: "Motivo", value: String(input.reason) })
  if (input.returnToStock !== undefined) summary.push({ label: "Devolução física ao estoque", value: input.returnToStock ? "Sim" : "Não" })
  return { resourceHash: await approvalResourceHash(tx, kind, payload), summary }
}
