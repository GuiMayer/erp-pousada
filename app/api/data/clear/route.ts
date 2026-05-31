import { NextResponse } from "next/server"
import { clearAllCollections } from "@/lib/server/db/relational-data-service"

export async function POST() {
  await clearAllCollections()

  return NextResponse.json({ success: true })
}
