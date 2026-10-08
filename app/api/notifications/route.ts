import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorize } from "@/lib/server/auth"
import { handleRoute, readJson } from "@/lib/server/http"
import { listInbox, changeInbox } from "@/lib/server/notifications/inbox"
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await authorize(request)
    const query = request.nextUrl.searchParams
    const cursor = query.get("date") || query.get("id") ? z.object({ date: z.string().datetime(), id: z.string().uuid() }).parse({ date: query.get("date"), id: query.get("id") }) : undefined
    return NextResponse.json(await listInbox(actor, cursor, query.get("archived") === "true"), { headers: { "Cache-Control": "no-store" } })
  })
}
export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await authorize(request)
    const input = z.object({ ids: z.array(z.string().uuid()).max(200), action: z.enum(["read", "archive", "restore", "resolve"]) }).strict().parse(await readJson(request))
    await changeInbox(actor, input.ids, input.action)
    return NextResponse.json({ success: true })
  })
}
