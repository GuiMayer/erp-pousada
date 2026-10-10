import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { AuditLogTab } from "@/components/audit-log-tab"
vi.mock("@/lib/data/config", () => ({ getDataConfig: () => ({ adapter: "demo-localStorage" }) }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { id: "test" }, can: () => true }) }))
vi.mock("@/lib/app-context", () => ({ useApp: () => ({ auditLog: [{ id: "audit", date: "2026-10-08T14:30:00Z", user: "operador", action: "Operação aprovada", reference: "Comanda 1", metadata: { approverId: "supervisor-stable", executorId: "executor-stable", permission: "discount.override" } }] }) }))
describe("Detalhes da auditoria", () => {
  it("permite expandir uma aprovação mesmo sem antes/depois e usa horário de Brasília", () => {
    render(<AuditLogTab />)
    const button = screen.getByRole("button", { name: "Mostrar detalhes" })
    fireEvent.click(button)
    expect(button).toHaveAttribute("aria-expanded", "true")
    expect(screen.getAllByText(/supervisor-stable/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/executor-stable/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/11:30:00/).length).toBeGreaterThan(0)
  })
})
