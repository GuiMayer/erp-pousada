import { setLogActor, logEvent } from "./logging"
import { createHash, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"
import { effectivePermissions, APPROVAL_PERMISSIONS, type PermissionOverrides } from "@/lib/permissions"
import { demand } from "./permissions"
import { assertSameOrigin, HttpError } from "./http"

export const SESSION_COOKIE = "erp_session"
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")
const SESSION_SECONDS = 8 * 60 * 60
const dummyHash = bcrypt.hashSync(randomBytes(32).toString("hex"), 12)

export type Actor = { id: string; username: string; role: "operador" | "supervisor"; sessionId: string; approvedUntil: Date | null; permissions?: string[]; accessProfile?: string | null; accessVersion?: number; permissionOverrides?: PermissionOverrides; grantedPermissions?: string[] }

export async function requireSession(request: NextRequest, supervisor = false): Promise<Actor> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(401, "Entre para continuar")
  const session = await prisma.authSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } })
  if (!session || session.expiresAt <= new Date() || !session.user.active) throw new HttpError(401, "Sessão expirada")
  const { user } = session
  if (user.role !== "operador" && user.role !== "supervisor") throw new HttpError(403, "Perfil inválido")
  const actor: Actor = { id: user.id, username: user.username, role: user.role, sessionId: session.id, approvedUntil: null, permissions: effectivePermissions(user), accessProfile: user.accessProfile, accessVersion: user.accessVersion, permissionOverrides: user.permissionOverrides as PermissionOverrides }
  setLogActor(actor.id)
  if (supervisor) demand(actor, "users.manage")
  return actor
}

export async function authorize(request: NextRequest, supervisor = false) {
  if (!["GET", "HEAD"].includes(request.method)) assertSameOrigin(request)
  return requireSession(request, supervisor)
}

export async function limitAuthentication(key: string, maximum = 10) {
  const id = hashToken(key)
  const now = new Date()
  const resetAt = new Date(now.getTime() + 15 * 60_000)
  // Expiry resets are conditional, and increments happen in the database.
  await prisma.authRateLimit.updateMany({ where: { id, resetAt: { lte: now } }, data: { attempts: 0, resetAt } })
  const bucket = await prisma.authRateLimit.upsert({ where: { id }, create: { id, attempts: 1, resetAt }, update: { attempts: { increment: 1 } } })
  if (bucket.attempts > maximum) throw new HttpError(429, "Muitas tentativas. Aguarde 15 minutos.")
}

export async function authenticate(username: string, password: string) {
  await limitAuthentication(`login:${username}`)
  const user = await prisma.user.findUnique({ where: { username } })
  const valid = await bcrypt.compare(password, user?.password ?? dummyHash)
  if (!valid || !user?.active || !["supervisor", "operador"].includes(user.role)) {
    logEvent("warn", "authentication.failed", { subjectHash: hashToken(username) })
    throw new HttpError(401, "Credenciais inválidas")
  }
  await prisma.authRateLimit.deleteMany({ where: { id: hashToken(`login:${username}`) } })
  return user
}

export async function issueSession(user: { id: string; username: string; role: string }) {
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000)
  await prisma.$transaction(async tx => {
    const session = await tx.authSession.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt } })
    await tx.userSession.create({ data: { id: session.id, userId: user.id, username: user.username } })
    await tx.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
    await tx.userSession.updateMany({ where: { userId: user.id, logoutTime: null, loginTime: { lte: new Date(Date.now() - SESSION_SECONDS * 1000) } }, data: { logoutTime: new Date() } })
  })
  const current = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
  const response = NextResponse.json({ user: { id: current.id, username: current.username, role: current.role, permissions: effectivePermissions(current), accessProfile: current.accessProfile, accessVersion: current.accessVersion, approvablePermissions: APPROVAL_PERMISSIONS.filter(key => (current.permissionOverrides as PermissionOverrides)?.[key] !== "deny") } })
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS })
  return response
}
