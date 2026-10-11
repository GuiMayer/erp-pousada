import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/auth";
import { handleRoute } from "@/lib/server/http";
import { financialForecast } from "@/lib/server/financial-forecast";
import { reportCSV } from "@/lib/reports/management";
import { z } from "zod";
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const input = Object.fromEntries(request.nextUrl.searchParams),
      format = z.enum(["view", "csv", "json"]).parse(input.format ?? "view");
    delete input.format;
    const report = await financialForecast(
        await requireSession(request),
        input,
        format === "view" ? undefined : format,
      ),
      headers: Record<string, string> = {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      };
    if (format !== "view")
      headers["Content-Disposition"] =
        `attachment; filename="projecao-${report.start}-${report.end}.${format}"`;
    if (format === "csv")
      return new NextResponse(reportCSV(report), {
        headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
      });
    return NextResponse.json(report, { headers });
  }, request);
}
