import { NextRequest, NextResponse } from "next/server"
import { authorize } from "@/lib/server/auth"
import { can } from "@/lib/server/permissions"
import { handleRoute, HttpError } from "@/lib/server/http"
import { lookupCompany } from "@/lib/server/company-lookup"

const attempts = new Map<string, { start: number; count: number }>()
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await authorize(request)
    if (!["customers.create", "customers.edit", "suppliers.create", "suppliers.edit"].some(p => can(actor, p))) throw new HttpError(403, "Sem permissão para consultar cadastros")
    const now = Date.now()
    for (const [key, entry] of attempts) if (entry.start < now - 60000) attempts.delete(key)
    const entry = attempts.get(actor.id) ?? { start: now, count: 0 }
    if (++entry.count > 10) throw new HttpError(429, "Aguarde um minuto para consultar novamente")
    attempts.set(actor.id, entry)
    return NextResponse.json(await lookupCompany(request.nextUrl.searchParams.get("cnpj") ?? ""), { headers: { "Cache-Control": "no-store" } })
  }, request)
}
