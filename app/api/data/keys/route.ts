import { NextResponse } from "next/server"
import { getCollectionNames } from "@/lib/server/db/relational-data-service"

export async function GET() {
  return NextResponse.json(await getCollectionNames())
}
