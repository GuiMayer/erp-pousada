import { getCollectionMapper } from "@/lib/server/db/mappers"
import { prisma } from "@/lib/db/client"
import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/server/db/relational-data-service"
import { authorizeCollection } from "@/lib/server/data-permissions"
import { handleRoute, HttpError } from "@/lib/server/http"
type Context = { params: Promise<{ key: string }> }
export async function GET(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const { key } = await context.params
    const actor = await authorizeCollection(request, key)
    const rows = key === "bankAccounts" && !actor.permissions?.includes("bankAccounts.read") ? await prisma.bankAccount.findMany({ where: { active: true }, select: { id: true, name: true, type: true, active: true } }) : key === "auditLog" ? (await prisma.auditEntry.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }], take: 500 })).map(row => getCollectionMapper("auditLog")!.toApp(row)) : await getCollection(key)
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } })
  }, request)
}
export async function PUT(request: NextRequest, context: Context) {
  return handleRoute(async () => { await authorizeCollection(request, (await context.params).key); throw new HttpError(405, "Use as operações por registro ou importação completa") }, request)
}
export const DELETE = PUT
