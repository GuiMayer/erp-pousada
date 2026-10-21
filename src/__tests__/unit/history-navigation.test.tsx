import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ActiveTabProvider, useActiveTab } from "@/contexts/active-tab-context"
import { phoneDestinations } from "@/components/mobile-navigation"
import { ALL_PERMISSIONS, canAccessTab, effectivePermissions } from "@/lib/permissions"

const access = vi.hoisted(() => ({ permissions: ["rooms.read", "history.read", "stays.read"], can: (p: string): boolean => access.permissions.includes(p) }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: access.can }) }))
function Harness() {
  const { activeTab, setActiveTab } = useActiveTab()
  return <><output aria-label="Módulo atual">{activeTab}</output><button onClick={() => setActiveTab("historico")}>Abrir histórico</button><button onClick={() => setActiveTab("mapa")}>Abrir mapa</button></>
}
beforeEach(() => { cleanup(); access.permissions = ["rooms.read", "history.read", "stays.read"]; window.history.replaceState(null, "", "/?modulo=mapa") })

describe("Navegação e autorização do Histórico", () => {
  it("exige acesso ao módulo e leitura de ao menos uma das entidades", () => {
    expect(ALL_PERMISSIONS).toContain("history.read")
    for (const permissions of [["history.read"], ["stays.read"], ["reservations.read"], []]) expect(canAccessTab("historico", p => permissions.includes(p))).toBe(false)
    for (const collection of ["stays.read", "reservations.read"]) expect(canAccessTab("historico", p => ["history.read", collection].includes(p))).toBe(true)
  })
  it("permite bloquear apenas o Histórico sem remover o acesso às reservas", () => {
    const permissions = effectivePermissions({ accessProfile: "recepcao", permissionOverrides: { "history.read": "deny" } })
    expect(canAccessTab("reservas", p => permissions.includes(p))).toBe(true)
    expect(canAccessTab("historico", p => permissions.includes(p))).toBe(false)
    for (const accessProfile of ["administrador", "supervisor", "recepcao", "caixa"]) {
      const granted = effectivePermissions({ accessProfile })
      expect(canAccessTab("historico", p => granted.includes(p))).toBe(true)
    }
  })
  it("oferece Histórico no menu mobile preservando os quatro atalhos operacionais", () => {
    const destinations = phoneDestinations(() => true)
    expect(destinations.slice(0, 4).map(d => d.key)).toEqual(["mapa", "reservas", "pdv", "estoque"])
    expect(destinations.find(d => d.key === "historico")?.label).toBe("Histórico")
    expect(phoneDestinations(p => p !== "history.read").some(d => d.key === "historico")).toBe(false)
  })
  it("abre por URL, troca de módulo e respeita o voltar do navegador", () => {
    window.history.replaceState(null, "", "/?modulo=historico")
    render(<ActiveTabProvider><Harness /></ActiveTabProvider>)
    expect(screen.getByLabelText("Módulo atual")).toHaveTextContent("historico")
    fireEvent.click(screen.getByText("Abrir mapa"))
    expect(window.location.search).toBe("?modulo=mapa")
    window.history.replaceState(null, "", "/?modulo=historico")
    fireEvent(window, new PopStateEvent("popstate"))
    expect(screen.getByLabelText("Módulo atual")).toHaveTextContent("historico")
  })
  it("recusa URL e navegação para usuário bloqueado, inclusive sem acesso ao Mapa", () => {
    access.permissions = ["reservations.read"]
    window.history.replaceState(null, "", "/?modulo=historico")
    render(<ActiveTabProvider><Harness /></ActiveTabProvider>)
    expect(screen.getByLabelText("Módulo atual")).toHaveTextContent("reservas")
    fireEvent.click(screen.getByText("Abrir histórico"))
    expect(window.location.search).toBe("?modulo=reservas")
  })
})
