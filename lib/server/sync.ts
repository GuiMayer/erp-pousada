import { Client } from "pg"
import { logEvent } from "./logging"

type Sink = (module: string) => void
type Hub = { client?: Client; sinks: Set<Sink>; connecting: boolean; timer?: ReturnType<typeof setTimeout>; failures: number }
const shared = globalThis as unknown as { erpSync?: Hub }
const hub = shared.erpSync ??= { sinks: new Set(), connecting: false, failures: 0 }

async function connect() {
  if (hub.client || hub.connecting || !hub.sinks.size) return
  hub.connecting = true
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, application_name: "erp-sync" })
  const lost = () => {
    if (hub.client !== client) return
    hub.client = undefined
    void client.end().catch(() => {})
    logEvent("warn", "sync.disconnected")
    schedule()
  }
  client.on("error", lost)
  client.on("end", lost)
  client.on("notification", event => { if (event.channel === "erp_sync" && event.payload) for (const sink of hub.sinks) sink(event.payload) })
  try {
    await client.connect()
    await client.query("LISTEN erp_sync")
    if (!hub.sinks.size) { await client.end(); return }
    hub.client = client; hub.failures = 0
    logEvent("info", "sync.connected")
    // NOTIFY is not durable: reconnect always invalidates authorized data.
    for (const sink of hub.sinks) sink("reconnected")
  } catch {
    await client.end().catch(() => {})
    schedule()
  } finally { hub.connecting = false }
}
function schedule() {
  if (hub.timer || !hub.sinks.size) return
  const delay = Math.min(30000, 500 * 2 ** Math.min(hub.failures++, 6))
  logEvent("info", "sync.retry", { durationMs: delay })
  hub.timer = setTimeout(() => { hub.timer = undefined; void connect() }, delay)
}
export function subscribeSync(sink: Sink) {
  hub.sinks.add(sink); void connect()
  return () => {
    hub.sinks.delete(sink)
    if (!hub.sinks.size) {
      clearTimeout(hub.timer); hub.timer = undefined
      const client = hub.client; hub.client = undefined
      void client?.end().catch(() => {})
    }
  }
}
