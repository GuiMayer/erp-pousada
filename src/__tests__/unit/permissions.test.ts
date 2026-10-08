import { describe, it, expect } from "vitest"
import { effectivePermissions, ALL_PERMISSIONS, PROFILES, operationPermissions } from "@/lib/permissions"
describe("Perfis e exceções", () => {
  it("permissões de operação existem no catálogo", () => {
    expect(Object.values(operationPermissions).every(key => ALL_PERMISSIONS.includes(key))).toBe(true)
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length)
  })
  it("preserva os perfis anteriores e nega perfil desconhecido", () => {
    expect(effectivePermissions({ role: "supervisor" })).toContain("users.manage")
    expect(effectivePermissions({ role: "operador" })).toContain("rooms.read")
    expect(effectivePermissions({ role: "operador" })).not.toContain("users.read")
    expect(effectivePermissions({ accessProfile: "unknown" })).toEqual([])
  })
  it("bloqueio substitui herança e concessão individual substitui ausência", () => {
    const permissions = effectivePermissions({ accessProfile: "recepcao", permissionOverrides: { "reservations.edit": "deny", "stockItems.read": "allow", forged: "allow" } })
    expect(permissions).not.toContain("reservations.edit")
    expect(permissions).toContain("stockItems.read")
    expect(permissions).not.toContain("forged")
  })
  it("receber dinheiro não permite ler saldos ou gerenciar banco", () => {
    for (const accessProfile of ["recepcao", "caixa", "restaurante"]) {
      const permissions = effectivePermissions({ accessProfile })
      expect(permissions).toContain("bankAccounts.use")
      expect(permissions).not.toContain("bankAccounts.read")
      expect(permissions).not.toContain("bankAccounts.transfer")
    }
  })
  it.each(Object.keys(PROFILES))("%s usa apenas permissões conhecidas", profile => {
    expect(PROFILES[profile].permissions.every(key => ALL_PERMISSIONS.includes(key))).toBe(true)
  })
})
