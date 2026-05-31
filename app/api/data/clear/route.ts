import { NextResponse } from "next/server"
import { LocalDatabaseAdapter } from "@/lib/data/local-database-adapter"

const adapter = new LocalDatabaseAdapter()

export async function POST() {
  await adapter.clear()

  return NextResponse.json({ success: true })
}
