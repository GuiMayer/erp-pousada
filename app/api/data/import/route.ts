import { NextRequest, NextResponse } from "next/server"
import { importAllCollections } from "@/lib/server/db/relational-data-service"
import { authorize } from "@/lib/server/auth"
import { handleRoute, readJson } from "@/lib/server/http"
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await authorize(request, true)
    await importAllCollections(JSON.stringify(await readJson(request, 10_485_760)))
    return NextResponse.json({ success: true })
  })
}
