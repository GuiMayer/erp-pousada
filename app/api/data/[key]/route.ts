import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/server/db/relational-data-service"
import { authorizeCollection } from "@/lib/server/data-permissions"
import { handleRoute, HttpError } from "@/lib/server/http"
type Context = { params: Promise<{ key: string }> }
export async function GET(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const { key } = await context.params
    await authorizeCollection(request, key)
    return NextResponse.json(await getCollection(key), { headers: { "Cache-Control": "no-store" } })
  })
}
export async function PUT(request: NextRequest, context: Context) {
  return handleRoute(async () => { await authorizeCollection(request, (await context.params).key); throw new HttpError(405, "Use as operações por registro ou importação completa") })
}
export const DELETE = PUT
