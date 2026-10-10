import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { assertSameOrigin } from "@/lib/server/http"

afterEach(() => vi.unstubAllEnvs())
const request = (url: string, origin?: string) => {
  const value = new NextRequest(url, { method: "POST" })
  // The browser test runtime removes Origin from Request constructor headers.
  // Incoming server requests already carry it; set it after construction here.
  if (origin) value.headers.set("origin", origin)
  return value
}

describe("Origem no desenvolvimento e na instalação", () => {
  it.each([3000, 3001, 3002])("aceita aliases locais na porta %s durante desenvolvimento", port => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("APP_URL", "https://pousada.example")
    expect(() => assertSameOrigin(request(`http://localhost:${port}/api/auth/login`, `http://127.0.0.1:${port}`))).not.toThrow()
    expect(() => assertSameOrigin(request(`http://127.0.0.1:${port}/api/auth/login`, `http://localhost:${port}`))).not.toThrow()
  })
  it.each([undefined, "null", "https://example.com", "http://localhost:3001", "http://localhost.example:3002", "https://localhost:3002"])("recusa origem ausente, externa ou com porta/protocolo diferente: %s", origin => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("APP_URL", "https://pousada.example")
    expect(() => assertSameOrigin(request("http://localhost:3002/api/auth/login", origin))).toThrow("Origem não autorizada")
  })
  it("produção aceita somente a origem configurada mesmo quando acessada por loopback", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("APP_URL", "https://pousada.example")
    expect(() => assertSameOrigin(request("http://localhost:3000/api/auth/login", "https://pousada.example"))).not.toThrow()
    expect(() => assertSameOrigin(request("http://localhost:3000/api/auth/login", "http://localhost:3000"))).toThrow("Origem não autorizada")
  })
  it("sem APP_URL conserva a validação da própria origem", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("APP_URL", "")
    expect(() => assertSameOrigin(request("https://pousada.example/api/auth/login", "https://pousada.example"))).not.toThrow()
    expect(() => assertSameOrigin(request("https://pousada.example/api/auth/login", "https://example.com"))).toThrow("Origem não autorizada")
  })
})
