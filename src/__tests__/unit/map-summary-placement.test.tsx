import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DashboardShell } from "@/components/dashboard-shell"
import { ActiveTabProvider } from "@/contexts/active-tab-context"
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: () => true }) }))
vi.mock("@/lib/app-context", () => ({ useApp: () => ({ rooms: [{ id: 1, status: "ocupado" }, { id: 2, status: "disponivel" }] }) }))
vi.mock("@/hooks/use-phone-layout", () => ({ usePhoneLayout: () => false }))
vi.mock("@/components/dashboard-header", () => ({ DashboardHeader: () => <header>Minha pousada</header> }))
vi.mock("@/components/room-grid", () => ({ RoomGrid: () => <p>Quartos do mapa</p> }))
vi.mock("@/components/reservations-tab", () => ({ ReservationsTab: () => null }))
vi.mock("@/components/history-tab", () => ({ HistoryTab: () => null }))
vi.mock("@/components/pos-tab", () => ({ POSTab: () => null }))
vi.mock("@/components/financial-tab", () => ({ FinancialTab: () => null }))
vi.mock("@/components/registrations-tab", () => ({ RegistrationsTab: () => null }))
vi.mock("@/components/stock/stock-tab", () => ({ StockTab: () => null }))
vi.mock("@/components/reports-tab", () => ({ ReportsTab: () => null }))
vi.mock("@/components/settings-tab", () => ({ SettingsTab: () => null }))
vi.mock("@/components/audit-log-tab", () => ({ AuditLogTab: () => null }))
describe("Resumo exclusivo e permanente do Mapa", () => {
  it("fica depois das abas e desaparece ao entrar em outros módulos", () => {
    render(<ActiveTabProvider><DashboardShell /></ActiveTabProvider>)
    const tabs = screen.getByRole("tablist"), summary = screen.getByRole("region", { name: "Resumo de quartos" })
    expect(tabs.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Financeiro" }), { button: 0, ctrlKey: false })
    expect(screen.queryByRole("region", { name: "Resumo de quartos" })).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Mapa" }), { button: 0, ctrlKey: false })
    expect(screen.getByRole("region", { name: "Resumo de quartos" })).toBeInTheDocument()
  })
})
