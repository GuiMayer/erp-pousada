import { NextRequest } from "next/server"
import { requireSession } from "@/lib/server/auth"
import { handleRoute } from "@/lib/server/http"
import { subscribeSync } from "@/lib/server/sync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    let actor = await requireSession(request)
    if (process.env.SYNC_EVENTS_ENABLED === "false") return new Response(null, { status: 204 })
    const encoder = new TextEncoder()
    let cleanup = () => {}
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false
        let checking = false
        let unsubscribe = () => {}
        let heartbeat: ReturnType<typeof setInterval>
        let expiry: ReturnType<typeof setTimeout>
        const close = () => {
          if (closed) return
          closed = true; clearInterval(heartbeat); clearTimeout(expiry); unsubscribe()
          request.signal.removeEventListener("abort", close)
          try { controller.close() } catch { /* disconnected reader */ }
        }
        cleanup = close
        const send = (module: string) => {
          if (closed) return
          if (module !== "reconnected" && module !== "notifications" && !actor.permissions?.includes(`${module}.read`)) return
          try { controller.enqueue(encoder.encode(`event: invalidate\ndata: ${JSON.stringify({ module })}\n\n`)) } catch { close() }
        }
        unsubscribe = subscribeSync(send)
        heartbeat = setInterval(() => {
          if (checking || closed) return
          checking = true
          void requireSession(request).then(current => {
            if (current.accessVersion !== actor.accessVersion) { close(); return }
            actor = current
            controller.enqueue(encoder.encode(": heartbeat\n\n"))
          }).catch(close).finally(() => { checking = false })
        }, 10000)
        expiry = setTimeout(close, 5 * 60 * 1000)
        request.signal.addEventListener("abort", close, { once: true })
        if (request.signal.aborted) close()
        else send("reconnected")
      },
      cancel() { cleanup() },
    })
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no", "Connection": "keep-alive" } })
  }, request)
}
