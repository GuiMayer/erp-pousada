import { NextResponse } from "next/server"
import { getStorageUsageBytes } from "@/lib/server/db/relational-data-service"

export async function GET() {
  return NextResponse.json({ bytes: await getStorageUsageBytes() })
}
