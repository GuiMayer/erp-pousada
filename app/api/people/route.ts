import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/auth";
import { handleRoute } from "@/lib/server/http";
import { personDossier } from "@/lib/server/person-dossier";
export async function GET(request: NextRequest) {
  return handleRoute(
    async () =>
      NextResponse.json(
        await personDossier(
          await requireSession(request),
          Object.fromEntries(request.nextUrl.searchParams),
        ),
        { headers: { "Cache-Control": "no-store" } },
      ),
    request,
  );
}
