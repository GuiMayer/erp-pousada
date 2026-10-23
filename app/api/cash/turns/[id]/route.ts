import { cashSummary } from "@/lib/server/cash-summary"
import { NextRequest, NextResponse } from "next/server"
import { authorize } from "@/lib/server/auth"
import { handleRoute } from "@/lib/server/http"
import { demand } from "@/lib/server/permissions"
import { prisma } from "@/lib/db/client"
import { collectionMapper } from "@/lib/server/db/relational-data-service"
import { cashIncoming } from "@/lib/payments"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    demand(await authorize(request), "cashCloses.read")
    const { id } = await params
    return prisma.$transaction(async tx => {
      const turn = await tx.cashClose.findUniqueOrThrow({ where: { id } })
      const entries = await tx.transaction.findMany({ where: { cashSessionId: id } })
      const total = (incoming: boolean) => entries.filter(e => cashIncoming(e.type) === incoming).reduce((sum, e) => sum + Math.round(Number(e.value) * 100), 0) / 100
      return NextResponse.json({ ...collectionMapper("cashCloses").toApp(turn) as object, incomingValue: total(true), outgoingValue: total(false), closingSummary: turn.status === "fechado" ? turn.closingSummary : await cashSummary(tx, turn) }, { headers: { "Cache-Control": "no-store" } })
    }, { isolationLevel: "RepeatableRead" })
  }, request)
}
