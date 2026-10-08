import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorize } from "@/lib/server/auth"
import { executeOperation } from "@/lib/server/operations"
import { handleRoute, readJson } from "@/lib/server/http"
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await authorize(request)
    const input = z.object({ requestId: z.string().uuid(), kind: z.string().max(50), payload: z.unknown() }).strict().parse(await readJson(request))
    return NextResponse.json(await executeOperation(actor, input.requestId, input.kind, input.payload))
  }, request)
}
