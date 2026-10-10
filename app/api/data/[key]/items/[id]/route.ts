import { NextRequest, NextResponse } from "next/server"
import { getCollection, updateCollectionItem, deleteCollectionItem } from "@/lib/server/db/relational-data-service"
import { authorizeCollection } from "@/lib/server/data-permissions"
import { handleRoute, readJson, HttpError } from "@/lib/server/http"
type Context = { params: Promise<{ key: string; id: string }> }
export async function GET(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const { key, id } = await context.params
    await authorizeCollection(request, key)
    const item = (await getCollection(key)).find(value => {
      const row = value as { id?: string | number; cpf?: string; roomId?: number }
      return String(key === "guests" ? row.cpf : key === "consumptions" ? row.roomId : row.id) === id
    })
    if (!item) throw new HttpError(404, "Registro removido", { code: "RESOURCE_REMOVED" })
    return NextResponse.json(item)
  }, request)
}
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
    const expected = request.headers.get("If-Match")
    await deleteCollectionItem(key, id, undefined, actor, expected && /^\d+$/.test(expected) ? Number(expected) : undefined)
    return NextResponse.json({ success: true })
  }, request)
}
