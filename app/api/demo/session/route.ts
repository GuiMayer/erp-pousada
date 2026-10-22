import { getDataConfig } from "@/lib/data/config"
import { demoStartedAt } from "@/lib/server/demo-session"

export const dynamic = "force-dynamic"

export async function GET() {
  if (getDataConfig().adapter !== "demo-localStorage") return new Response(null, { status: 404 })
  return Response.json({ startedAt: demoStartedAt() }, { headers: { "Cache-Control": "no-store" } })
}
