import { NextRequest, NextResponse } from "next/server"
import { LocalDatabaseAdapter } from "@/lib/data/local-database-adapter"

type RouteContext = {
  params: Promise<{ key: string }>
}

const adapter = new LocalDatabaseAdapter()

export async function GET(_request: NextRequest, context: RouteContext) {
  const { key } = await context.params
  const data = await adapter.get(decodeURIComponent(key))

  if (data === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { key } = await context.params
  const data = await request.json()

  await adapter.set(decodeURIComponent(key), data)

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { key } = await context.params

  await adapter.remove(decodeURIComponent(key))

  return NextResponse.json({ success: true })
}
