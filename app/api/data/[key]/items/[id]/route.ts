import { NextRequest, NextResponse } from "next/server"
import { updateCollectionItem, deleteCollectionItem } from "@/lib/server/db/relational-data-service"
import { authorizeCollection } from "@/lib/server/data-permissions"
import { handleRoute, readJson } from "@/lib/server/http"
type Context = { params: Promise<{ key: string; id: string }> }
export async function PATCH(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const { key, id } = await context.params
    const actor = await authorizeCollection(request, key)
    return NextResponse.json(await updateCollectionItem(key, id, await readJson(request), actor))
  }, request)
}
export async function DELETE(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const { key, id } = await context.params
    const actor = await authorizeCollection(request, key)
    await deleteCollectionItem(key, id, undefined, actor)
    return NextResponse.json({ success: true })
  }, request)
}
