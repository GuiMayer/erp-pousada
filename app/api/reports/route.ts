import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth";
import { handleRoute } from "@/lib/server/http";
import { getManagementReport } from "@/lib/server/management-reports";
import { reportCSV } from "@/lib/reports/management";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireSession(request),
      params = request.nextUrl.searchParams;
    const format = z
      .enum(["view", "csv", "json"])
      .parse(params.get("format") ?? "view");
    const report = await getManagementReport(
      actor,
      {
        section: params.get("section"),
        start: params.get("start"),
        end: params.get("end"),
      },
      format === "view" ? undefined : format,
    );
    const headers: Record<string, string> = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (format !== "view")
      headers["Content-Disposition"] =
        `attachment; filename="gerencial-${report.section}-${report.start}-${report.end}.${format}"`;
    if (format === "csv") {
      headers["Content-Type"] = "text/csv; charset=utf-8";
      return new NextResponse(reportCSV(report), { headers });
    }
    return NextResponse.json(report, { headers });
  }, request);
}
