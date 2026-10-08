import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"

export type LogContext = { requestId: string; route: string; method: string; actorId?: string; operation?: string }
export const logContext = new AsyncLocalStorage<LogContext>()
export function setLogActor(actorId: string) { const context = logContext.getStore(); if (context) context.actorId = actorId }
export function setLogOperation(operation: string) { const context = logContext.getStore(); if (context) context.operation = operation }

// Error messages, request bodies, headers and query strings are deliberately excluded.
export function logEvent(level: "info" | "warn" | "error", event: string, fields: { status?: number; durationMs?: number; permission?: string; subjectHash?: string } = {}, error?: unknown) {
  const candidate = error as { name?: unknown; code?: unknown; stack?: unknown } | undefined
  const safeCode = typeof candidate?.code === "string" && /^[A-Z0-9_]{1,32}$/.test(candidate.code) ? candidate.code : undefined
  const safeName = typeof candidate?.name === "string" && /^[A-Za-z]{1,60}$/.test(candidate.name) ? candidate.name : undefined
  const frames = typeof candidate?.stack === "string" ? candidate.stack.split("\n").filter(line => /^\s+at /.test(line)).flatMap(line => {
    const match = line.match(/([A-Za-z0-9_.-]+\.(?:[cm]?js|tsx?)):(\d+):(\d+)\)?$/)
    return match ? [{ file: match[1], line: Number(match[2]), column: Number(match[3]) }] : []
  }).slice(0, 6) : undefined
  const record = { timestamp: new Date().toISOString(), level, event, ...logContext.getStore(), ...fields, errorType: safeName, errorCode: safeCode, frames }
  console[level === "info" ? "log" : level](JSON.stringify(record))
}
export function requestContext(request?: Request): LogContext {
  return { requestId: randomUUID(), route: request ? new URL(request.url).pathname : "unknown", method: request?.method ?? "unknown" }
}
