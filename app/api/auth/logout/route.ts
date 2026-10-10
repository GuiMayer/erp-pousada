import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"
import { authorize, SESSION_COOKIE } from "@/lib/server/auth"
import { handleRoute } from "@/lib/server/http"
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await authorize(request)
    await prisma.$transaction(async tx => {
      await tx.authSession.deleteMany({ where: { id: actor.sessionId } })
      await tx.userSession.updateMany({ where: { id: actor.sessionId }, data: { logoutTime: new Date() } })
    })
    const response = NextResponse.json({ success: true })
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 })
    return response
  }, request)
}
