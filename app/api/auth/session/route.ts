import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/server/auth"
import { handleRoute } from "@/lib/server/http"
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireSession(request)
    return NextResponse.json({ user: { id: actor.id, username: actor.username, role: actor.role } }, { headers: { "Cache-Control": "no-store" } })
  })
}
