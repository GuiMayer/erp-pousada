import { afterEach, describe, expect, it, vi } from "vitest"
import { lookupCompany } from "@/lib/server/company-lookup"
afterEach(() => vi.unstubAllGlobals())
describe("Consulta opcional de empresa", () => {
  it("retorna somente uma sugestão de cadastro e não salva dados", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ cnpj: "12ABC34501DE35", razao_social: "Empresa Exemplo", logradouro: "Rua A", numero: "1", qsa: [{ nome_socio: "Não retornar" }] }))
    vi.stubGlobal("fetch", fetch)
    expect(await lookupCompany("12.abc.345/01de-35")).toMatchObject({ name: "Empresa Exemplo", address: "Rua A, 1", cpfCnpj: "12ABC34501DE35" })
    expect(fetch.mock.calls[0][0]).toBe("https://brasilapi.com.br/api/cnpj/v1/12ABC34501DE35")
  })
  it("permite alternativa manual quando há falha ou documento divergente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")))
    await expect(lookupCompany("11222333000181")).rejects.toThrow("manualmente")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ cnpj: "52998224725", razao_social: "Outra empresa" })))
    await expect(lookupCompany("11222333000181")).rejects.toThrow("conferir")
  })
})
