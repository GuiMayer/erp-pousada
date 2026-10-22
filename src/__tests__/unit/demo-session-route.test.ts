import { afterEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/demo/session/route"
import { demoStartedAt } from "@/lib/server/demo-session"

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

describe("browser demo server session", () => {
  it("does not expose or initialize a scenario in database mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    expect((await GET()).status).toBe(404)
  })

  it("shares the process start across requests and midnight instead of using the browser clock", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "demo-localStorage")
    vi.stubEnv("ERP_DEMO_STARTED_AT", "2026-10-22T15:00:00.000Z")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-22T15:00:00Z"))
    const first = await GET()
    expect(first.headers.get("Cache-Control")).toBe("no-store")
    vi.setSystemTime(new Date("2026-10-23T15:00:00Z"))
    expect(await (await GET()).json()).toEqual(await first.json())
    expect(demoStartedAt()).toBe("2026-10-22T15:00:00.000Z")
  })
})
