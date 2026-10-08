import { demand } from "@/lib/server/permissions"
import { NextRequest, NextResponse } from "next/server"
import { clearAllCollections } from "@/lib/server/db/relational-data-service"
import { authorize } from "@/lib/server/auth"
import { handleRoute } from "@/lib/server/http"
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await authorize(request)
    demand(actor, "data.restore")
    const result = await clearAllCollections(actor)
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
  })
}
