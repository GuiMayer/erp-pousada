import { NextRequest, NextResponse } from "next/server"
import { exportAllCollections } from "@/lib/server/db/relational-data-service"
import { authorize } from "@/lib/server/auth"
import { handleRoute } from "@/lib/server/http"
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    await authorize(request, true)
    const result = await exportAllCollections()
    return NextResponse.json(JSON.parse(result), { headers: { "Cache-Control": "no-store" } })
  })
}
