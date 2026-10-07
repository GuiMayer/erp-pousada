import { NextRequest, NextResponse } from "next/server"
import { getCollectionNames } from "@/lib/server/db/relational-data-service"
import { authorize } from "@/lib/server/auth"
import { handleRoute } from "@/lib/server/http"
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    await authorize(request, true)
    const result = await getCollectionNames()
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  })
}
