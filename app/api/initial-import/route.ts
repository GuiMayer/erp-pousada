import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/server/auth";
import { handleRoute, readJson } from "@/lib/server/http";
import {
  previewInitialImport,
  confirmInitialImport,
} from "@/lib/server/initial-import";
import { z } from "zod";
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await authorize(request),
      q = z
        .object({ action: z.enum(["preview", "confirm"]), data: z.unknown() })
        .strict()
        .parse(await readJson(request, 262144));
    return NextResponse.json(
      q.action === "preview"
        ? await previewInitialImport(actor, q.data)
        : await confirmInitialImport(actor, q.data),
      { headers: { "Cache-Control": "no-store" } },
    );
  }, request);
}
