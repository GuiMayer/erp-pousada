import { NextResponse } from "next/server"
import { LocalDatabaseAdapter } from "@/lib/data/local-database-adapter"

const adapter = new LocalDatabaseAdapter()

export async function GET() {
  return NextResponse.json(await adapter.keys())
}
