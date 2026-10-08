import { NextRequest, NextResponse } from "next/server"
import { authorize } from "@/lib/server/auth"
import { handleRoute, readJson } from "@/lib/server/http"
import { listInbox, updateInboxPreferences } from "@/lib/server/notifications/inbox"
export async function GET(request: NextRequest) {
  return handleRoute(async () => NextResponse.json((await listInbox(await authorize(request))).preferences, { headers: { "Cache-Control": "no-store" } }))
}
export async function PATCH(request: NextRequest) {
  return handleRoute(async () => NextResponse.json(await updateInboxPreferences(await authorize(request), await readJson(request))))
}
