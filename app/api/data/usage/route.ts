import { demand } from "@/lib/server/permissions"
import { NextRequest, NextResponse } from "next/server"
import { getStorageUsageBytes } from "@/lib/server/db/relational-data-service"
import { authorize } from "@/lib/server/auth"
import { handleRoute } from "@/lib/server/http"
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    demand(await authorize(request), "data.backup")
    const result = await getStorageUsageBytes()
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  })
}
