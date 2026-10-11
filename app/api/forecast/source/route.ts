import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth";
import { handleRoute, HttpError } from "@/lib/server/http";
import { demand } from "@/lib/server/permissions";
import { authorizeReport } from "@/lib/server/management-reports";
import { getReportSource } from "@/lib/server/report-source";
import { prisma } from "@/lib/db/client";
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireSession(request),
      q = z
        .object({
          collection: z.enum([
            "reservations",
            "expenses",
            "accountsReceivable",
          ]),
          id: z.string().min(1).max(200),
        })
        .strict()
        .parse(Object.fromEntries(request.nextUrl.searchParams));
    authorizeReport(actor, "financeiro");
    if (q.collection !== "reservations")
      return NextResponse.json(
        await getReportSource(actor, { section: "financeiro", ...q }),
        { headers: { "Cache-Control": "no-store" } },
      );
    demand(actor, "reservations.read");
    demand(actor, "stays.read");
    const document = await prisma.reservation.findUnique({
      where: { id: q.id },
      select: {
        id: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        totalValue: true,
        paidValue: true,
        status: true,
      },
    });
    if (!document) throw new HttpError(404, "Reserva não encontrada");
    return NextResponse.json(
      { document },
      { headers: { "Cache-Control": "no-store" } },
    );
  }, request);
}
