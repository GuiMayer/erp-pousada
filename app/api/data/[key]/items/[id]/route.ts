import { NextRequest, NextResponse } from "next/server"
import { deleteCollectionItem, updateCollectionItem } from "@/lib/server/db/relational-data-service"

type RouteContext = {
  params: Promise<{ key: string; id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { key, id } = await context.params
  const data = await request.json()
  const item = await updateCollectionItem(decodeURIComponent(key), decodeURIComponent(id), data)

  return NextResponse.json(item)
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { key, id } = await context.params

  await deleteCollectionItem(decodeURIComponent(key), decodeURIComponent(id))

  return NextResponse.json({ success: true })
}
