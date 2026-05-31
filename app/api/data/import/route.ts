import { NextRequest, NextResponse } from "next/server"
import { importAllCollections } from "@/lib/server/db/relational-data-service"

export async function POST(request: NextRequest) {
  const body = await request.text()

  await importAllCollections(body)

  return NextResponse.json({ success: true })
}
