import { NextRequest, NextResponse } from "next/server"
import { executeOperation } from "@/lib/server/operations"
import { z } from "zod"
import { authorizeCollection } from "@/lib/server/data-permissions"
import { handleRoute, readJson } from "@/lib/server/http"
export async function POST(request: NextRequest, context: { params: Promise<{ key: string }> }) {
  return handleRoute(async () => {
    const { key } = await context.params
    const actor = await authorizeCollection(request, key)
    const requestId = z.string().uuid().parse(request.headers.get("Idempotency-Key"))
    return NextResponse.json(await executeOperation(actor, requestId, "admin-create", { key, data: await readJson(request) }), { status: 201 })
  }, request)
}
