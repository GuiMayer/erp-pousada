import { NextRequest, NextResponse } from "next/server"
import { createCollectionItem } from "@/lib/server/db/relational-data-service"
import { authorizeCollection } from "@/lib/server/data-permissions"
import { handleRoute, readJson } from "@/lib/server/http"
export async function POST(request: NextRequest, context: { params: Promise<{ key: string }> }) {
  return handleRoute(async () => {
    const { key } = await context.params
    const actor = await authorizeCollection(request, key)
    return NextResponse.json(await createCollectionItem(key, await readJson(request), actor), { status: 201 })
  }, request)
}
