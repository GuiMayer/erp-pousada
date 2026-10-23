import type { Prisma } from "@prisma/client"
import { summarizeCash } from "@/lib/cash-summary"

export async function cashSummary(tx: Prisma.TransactionClient, turn: { id: string; openingValue: Prisma.Decimal }) {
  const [entries, charges] = await Promise.all([
    tx.transaction.findMany({ where: { OR: [{ operationalSessionId: turn.id }, { cashSessionId: turn.id }] } }),
    tx.stayCharge.findMany({ where: { operationalSessionId: turn.id } }),
  ])
  return summarizeCash({ id: turn.id, openingValue: Number(turn.openingValue) }, entries.map(e => ({ ...e, value: Number(e.value) })), charges.map(c => ({ ...c, unitPrice: Number(c.unitPrice), lineTotal: c.lineTotal === null ? null : Number(c.lineTotal) })))
}
