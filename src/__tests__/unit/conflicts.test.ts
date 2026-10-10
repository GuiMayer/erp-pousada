import { afterEach, describe, expect, it } from "vitest"
import { changedFields, clearSnapshots, rememberRows } from "@/lib/data/conflicts"
afterEach(clearSnapshots)
describe("Rascunho e versão original", () => {
  it("refresh novo não troca a base do formulário aberto", () => {
    rememberRows("customers", [{ id: "1", recordVersion: 0, name: "Original", phone: "10" }])
    rememberRows("customers", [{ id: "1", recordVersion: 1, name: "Outro usuário", phone: "10" }])
    expect(changedFields("customers", "1", { recordVersion: 0, name: "Original", phone: "20" })).toEqual({ recordVersion: 0, phone: "20" })
  })
  it("limpar campo explicitamente é diferente de omitir", () => {
    rememberRows("customers", [{ id: "1", recordVersion: 0, notes: "Antes", active: true }])
    expect(changedFields("customers", "1", { recordVersion: 0, notes: null })).toEqual({ recordVersion: 0, notes: null })
  })
})
