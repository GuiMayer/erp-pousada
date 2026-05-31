import { NextRequest, NextResponse } from "next/server"
import { upsertCollectionItem } from "@/lib/server/db/relational-data-service"

type RouteContext = {
  params: Promise<{ key: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { key } = await context.params
  const data = await request.json()
  const item = await upsertCollectionItem(decodeURIComponent(key), data)

  return NextResponse.json(item)
}
