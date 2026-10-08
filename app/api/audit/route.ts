import { NextRequest, NextResponse } from "next/server"
import { authorize } from "@/lib/server/auth"
import { handleRoute } from "@/lib/server/http"
import { listAudit } from "@/lib/server/audit-query"
export async function GET(request: NextRequest) {
  return handleRoute(async () => NextResponse.json(await listAudit(await authorize(request), request.nextUrl.searchParams), { headers: { "Cache-Control": "no-store" } }), request)
}
