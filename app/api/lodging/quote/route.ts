import { NextRequest, NextResponse } from "next/server"
import { authorize } from "@/lib/server/auth"
import { demand } from "@/lib/server/permissions"
import { prisma } from "@/lib/db/client"
import { handleRoute } from "@/lib/server/http"
import { serverQuote } from "@/lib/server/lodging-pricing"

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await authorize(request)
    demand(actor, "rooms.read"); demand(actor, "lodgingTariffs.read")
    const params = request.nextUrl.searchParams
    const quote = await prisma.$transaction(tx => serverQuote(tx, { roomId: Number(params.get("roomId")), guestCount: Number(params.get("guestCount")), checkIn: params.get("checkIn"), checkOut: params.get("checkOut") }), { isolationLevel: "RepeatableRead" })
    return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } })
  }, request)
}
