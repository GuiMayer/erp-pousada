import { NextResponse } from "next/server"
import { exportAllCollections } from "@/lib/server/db/relational-data-service"

export async function GET() {
  return new NextResponse(await exportAllCollections(), {
    headers: {
      "Content-Type": "application/json",
    },
  })
}
