import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/auth";
import { handleRoute } from "@/lib/server/http";
import { getReportSource } from "@/lib/server/report-source";
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireSession(request),
      q = request.nextUrl.searchParams;
    return NextResponse.json(
      await getReportSource(actor, {
        section: q.get("section"),
        collection: q.get("collection"),
        id: q.get("id"),
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  }, request);
}
