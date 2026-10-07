import { NextRequest, NextResponse } from "next/server"
import { clearAllCollections } from "@/lib/server/db/relational-data-service"
import { authorize } from "@/lib/server/auth"
import { handleRoute } from "@/lib/server/http"
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await authorize(request, true)
    const result = await clearAllCollections()
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
  })
}
