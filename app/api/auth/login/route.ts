import { NextRequest } from "next/server"
import { z } from "zod"
import { authenticate, issueSession } from "@/lib/server/auth"
import { assertSameOrigin, handleRoute, readJson } from "@/lib/server/http"
const credentials = z.object({ username: z.string().trim().min(1).max(100).transform(v => v.toLowerCase()), password: z.string().min(1).max(128) }).strict()
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    assertSameOrigin(request)
    const { username, password } = credentials.parse(await readJson(request, 4096))
    return issueSession(await authenticate(username, password))
  }, request)
}
