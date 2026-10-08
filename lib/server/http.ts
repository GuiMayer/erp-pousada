import { logContext, logEvent, requestContext } from "./logging"
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: { approvalRequired?: boolean; permission?: string; resourceHash?: string; summary?: { label: string; value: string }[] }) { super(message) }
}

export function assertSameOrigin(request: NextRequest) {
  const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : request.nextUrl.origin
  if (request.headers.get("origin") !== expected) throw new HttpError(403, "Origem não autorizada")
}

export async function readJson(request: NextRequest, limit = 1_048_576): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "Envie JSON")
  const reader = request.body?.getReader()
  if (!reader) throw new HttpError(400, "Corpo obrigatório")
  let size = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) { await reader.cancel(); throw new HttpError(413, "Dados excedem o limite") }
    chunks.push(value)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) }
  catch { throw new HttpError(400, "JSON inválido") }
}

export async function handleRoute(action: () => Promise<Response>, request?: Request): Promise<Response> {
  return logContext.run(requestContext(request), async () => {
    const started = Date.now()
    const response = await routeResponse(action)
    response.headers.set("X-Request-Id", logContext.getStore()!.requestId)
    logEvent("info", "request.completed", { status: response.status, durationMs: Date.now() - started })
    return response
  })
}

async function routeResponse(action: () => Promise<Response>): Promise<Response> {
  try { return await action() }
  catch (error) {
    if (error instanceof HttpError) {
      const context = logContext.getStore()
      if ([403, 429].includes(error.status) || error.status === 401 && ["/api/auth/login", "/api/auth/supervisor"].includes(context?.route ?? "")) {
        logEvent("warn", "security.denied", { status: error.status, permission: error.details?.permission })
      }
      return NextResponse.json({ error: error.message, ...error.details }, { status: error.status })
    }
    if (error instanceof ZodError) return NextResponse.json({ error: "Dados inválidos", issues: error.flatten() }, { status: 400 })
    if (error instanceof Error && error.name === "PrismaClientValidationError") return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    const code = (error as { code?: string })?.code
    if (code === "P2025") return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 })
    if (code === "P2002" || code === "P2003" || code === "P2034") return NextResponse.json({ error: "Conflito de dados. Atualize e tente novamente." }, { status: 409 })
    logEvent("error", "request.failed", { status: 500 }, error)
    return NextResponse.json({ error: "Não foi possível concluir a operação" }, { status: 500 })
  }
}
