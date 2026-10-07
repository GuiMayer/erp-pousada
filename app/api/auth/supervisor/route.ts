import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db/client"
import { authorize, limitAuthentication } from "@/lib/server/auth"
import { handleRoute, HttpError, readJson } from "@/lib/server/http"
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await authorize(request)
    await limitAuthentication(`approval:${actor.id}`)
    const { password } = z.object({ password: z.string().min(1).max(128) }).strict().parse(await readJson(request, 4096))
    const supervisors = await prisma.user.findMany({ where: { role: "supervisor", active: true } })
    let approvedBy: string | null = null
    for (const user of supervisors) { if (await bcrypt.compare(password, user.password)) approvedBy = user.username }
    if (!approvedBy) throw new HttpError(401, "Senha inválida")
    await prisma.authSession.update({ where: { id: actor.sessionId }, data: { approvedUntil: new Date(Date.now() + 5 * 60_000) } })
    await prisma.auditEntry.create({ data: { id: crypto.randomUUID(), user: actor.username, action: "Aprovação de supervisor", reference: approvedBy } })
    return NextResponse.json({ success: true })
  })
}
