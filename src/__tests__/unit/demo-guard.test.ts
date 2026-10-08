import { sessionCookieName } from "@/lib/server/session-config"
import { describe, expect, it } from "vitest"
import { assertDemoTarget } from "@/lib/server/demo-guard"
describe("Isolamento do banco demonstrativo", () => {
  it("separa os cookies mesmo quando as portas usam o mesmo localhost", () => {
    expect(sessionCookieName(false)).toBe("erp_session")
    expect(sessionCookieName(true)).toBe("erp_demo_session")
  })
  it("aceita somente o servidor e banco próprios com habilitação explícita", () => {
    expect(() => assertDemoTarget("postgresql://pousada_app:demo@postgres-demo:5432/pousada_demo", "true")).not.toThrow()
  })
  it.each(["postgresql://pousada_app:demo@postgres:5432/pousada", "postgresql://pousada_app:demo@localhost:5432/pousada_demo", "postgresql://pousada_app:demo@postgres-demo:5432/pousada", "postgresql://pousada_app:demo@postgres-demo:5433/pousada_demo", "https://postgres-demo/pousada_demo"])("recusa alvo externo ou operacional %s", url => {
    expect(() => assertDemoTarget(url, "true")).toThrow()
  })
  it("não inicia seed sem confirmação explícita de modo", () => {
    expect(() => assertDemoTarget("postgresql://postgres-demo/pousada_demo", undefined)).toThrow()
  })
})
