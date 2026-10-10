import { logEvent } from "@/lib/server/logging"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"
export const dynamic = "force-dynamic"
export async function GET() {
  try { await prisma.$queryRaw`SELECT 1`; return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } }) }
  catch (error) { logEvent("error", "health.database.failed", { status: 503 }, error); return NextResponse.json({ status: "unavailable" }, { status: 503 }) }
}
