import { NextRequest, NextResponse } from "next/server"
import { authorize } from "@/lib/server/auth"
import { cashStatus } from "@/lib/server/cash-status"
import { handleRoute } from "@/lib/server/http"

export async function GET(request: NextRequest) {
  return handleRoute(async () => NextResponse.json(await cashStatus(await authorize(request)), { headers: { "Cache-Control": "no-store" } }), request)
}
