import { NextRequest, NextResponse } from "next/server"
import { LocalDatabaseAdapter } from "@/lib/data/local-database-adapter"

const adapter = new LocalDatabaseAdapter()

export async function POST(request: NextRequest) {
  const body = await request.text()

  await adapter.import(body)

  return NextResponse.json({ success: true })
}
