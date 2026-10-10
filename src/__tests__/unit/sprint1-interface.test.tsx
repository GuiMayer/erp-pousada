import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LodgingTariffsManagement } from "@/components/lodging-tariffs-management"
import { CnpjLookup } from "@/components/cnpj-lookup"
import { phoneDestinations } from "@/components/mobile-navigation"
import { PROFILES } from "@/lib/permissions"
import type { LodgingTariff } from "@/lib/lodging-pricing"

const saveTariff = vi.fn()
const tariffs: LodgingTariff[] = [
  { id: "one", recordVersion: 3, name: "Uma pessoa", roomType: "Standard", minGuests: 1, maxGuests: 1, pricePerPerson: 120, validFrom: "2026-01-01", active: true },
  { id: "two", name: "Duas pessoas", roomType: "Standard", minGuests: 2, maxGuests: 2, pricePerPerson: 100, validFrom: "2026-01-01", active: true },
]
vi.mock("@/lib/app-context", () => ({ useApp: () => ({ rooms: [{ id: 1, number: "101", type: "Standard", capacity: 2 }], lodgingTariffs: tariffs, saveTariff }) }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: () => true }) }))
beforeEach(() => { saveTariff.mockReset(); vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))) })
afterEach(() => { vi.unstubAllGlobals() })
describe("Protótipo da sprint 1", () => {
  it("simula por ocupação sem salvar nada e mostra erro de capacidade", () => {
    render(<LodgingTariffsManagement />)
    fireEvent.change(screen.getByLabelText("Quarto"), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText("Entrada"), { target: { value: "2026-10-09" } })
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "2026-10-11" } })
    expect(screen.getByText(/2 noite\(s\) · Total/)).toHaveTextContent(/240/)
    fireEvent.change(screen.getByLabelText("Pessoas"), { target: { value: "2" } })
    expect(screen.getByText(/2 noite\(s\) · Total/)).toHaveTextContent(/400/)
    fireEvent.change(screen.getByLabelText("Pessoas"), { target: { value: "3" } })
    expect(screen.getByRole("status")).toHaveTextContent("comporta até 2")
    expect(saveTariff).not.toHaveBeenCalled()
  })
  it("permite inativar uma tarifa com versão para preservar referências", async () => {
    render(<LodgingTariffsManagement />)
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0])
    fireEvent.click(screen.getByLabelText("Tarifa ativa"))
    fireEvent.submit(screen.getByRole("button", { name: "Salvar tarifa" }).closest("form")!)
    await waitFor(() => expect(saveTariff).toHaveBeenCalledWith(expect.objectContaining({ id: "one", recordVersion: 3, active: false }), true))
  })
  it("consulta CNPJ não substitui dados até a confirmação", async () => {
    const apply = vi.fn()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ cpfCnpj: "12ABC34501DE35", name: "Empresa Exemplo", address: "Rua A", city: "Cidade", state: "PR", phone: "", email: "" })))
    render(<CnpjLookup document="12.abc.345/01de-35" onApply={apply} />)
    fireEvent.click(screen.getByRole("button", { name: "Consultar CNPJ" }))
    await screen.findByText("Empresa Exemplo")
    expect(apply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Usar estes dados" }))
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ cpfCnpj: "12ABC34501DE35" }))
  })
  it("recepção encontra cadastros no menu mobile sem perder atalhos", () => {
    const permissions = PROFILES.recepcao.permissions
    const destinations = phoneDestinations(p => permissions.includes(p)).map(d => d.key)
    expect(destinations).toContain("cadastros"); expect(destinations).toContain("mapa"); expect(destinations).not.toContain("administracao")
  })
})
