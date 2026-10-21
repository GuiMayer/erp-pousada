import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { distributePayment } from "@/lib/payments"
import type { Actor } from "./auth"
import { financeOperation, paymentFields } from "./business-finance"
import { HttpError } from "./http"
import { demand } from "./permissions"

export const initialPaymentSchema = z.object({
  value: z.number().finite().positive().max(999999999).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < .00001, "Use duas casas decimais"),
  ...paymentFields,
}).strict()

export async function receiveBookingDeposit(tx: Prisma.TransactionClient, actor: Actor, ids: string[], input?: z.infer<typeof initialPaymentSchema>) {
  if (!input) return
  demand(actor, "hospitality.receive")
  const reservations = await tx.reservation.findMany({ where: { id: { in: ids } } })
  let remaining = Math.round(input.value * 100)
  const capacity = reservations.reduce((sum, r) => sum + Math.round(Number(r.totalValue.minus(r.paidValue)) * 100), 0)
  if (remaining > capacity) throw new HttpError(409, "Recebimento excede o saldo das reservas")
  let plan: ReturnType<typeof distributePayment>
  try { plan = distributePayment(input.value, input.payments ?? [{ method: input.paymentMethod ?? "", accountId: input.accountId, value: input.value }]) }
  catch (error) { throw new HttpError(400, (error as Error).message) }
  const pool = plan.lines.map(p => ({ ...p, left: Math.round(p.applied * 100) }))
  for (const id of ids) {
    const r = reservations.find(item => item.id === id)!
    const value = Math.min(remaining, Math.round(Number(r.totalValue.minus(r.paidValue)) * 100))
    if (!value) continue
    let needed = value
    const payments = []
    for (const part of pool) {
      const applied = Math.min(needed, part.left)
      if (applied) payments.push({ method: part.method, accountId: part.accountId, value: applied / 100 })
      part.left -= applied; needed -= applied
    }
    await financeOperation(tx, actor, "pay-reservation", { reservationId: id, recordVersion: r.recordVersion, value: value / 100, payments })
    remaining -= value
  }
}
