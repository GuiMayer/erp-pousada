import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react"
import { FinancialTab } from "@/components/financial-tab"
import { RegistrationsTab } from "@/components/registrations-tab"
import { ReportsTab } from "@/components/reports-tab"
import { GuestsManagement } from "@/components/guests-management"
import { canAccessTab } from "@/lib/permissions"

const auth = vi.hoisted(() => ({ permissions: ["*"], can: (p: string): boolean => auth.permissions.includes("*") || auth.permissions.includes(p) }))
const addGuest = vi.fn(), addAuditEntry = vi.fn()
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: auth.can, username: "Teste", isSupervisor: true }) }))
vi.mock("@/contexts/task-drafts-context", async () => { const { useState } = await import("react"); return { useTaskState: (_key: string, initial: unknown) => useState(initial) } })
vi.mock("@/lib/data/config", () => ({ getDataConfig: () => ({ adapter: "database" }) }))
vi.mock("@/components/payment-fields", () => ({ PaymentDialog: () => null }))
vi.mock("@/components/cash-session-panel", () => ({ CashSessionPanel: () => <p>Operação de turno</p> }))
vi.mock("@/components/accounts-receivable-management", () => ({ AccountsReceivableManagement: () => <p>Lista de cobranças</p> }))
vi.mock("@/components/reports/management-reports", () => ({ ManagementReports: () => <p>Indicadores gerenciais</p> }))
vi.mock("@/lib/app-context", () => ({ useApp: () => ({
  expenses: [{ id: "expense", description: "Compra de teste", category: "Bebidas", value: 40, dueDate: "2026-10-24", paid: false }],
  transactions: [{ id: "oct", date: "2026-10-22", description: "Entrada de outubro", value: 100, type: "receita" }, { id: "sep", date: "2026-09-22", description: "Entrada de setembro", value: 200, type: "receita" }],
  categories: [], reservations: [], cashCloses: [], bankAccounts: [], bankTransfers: [], costCenters: [], budgets: [], recurringTransactions: [], guests: [],
  addGuest, addAuditEntry,
}) }))
beforeEach(() => { cleanup(); auth.permissions = ["*"]; addGuest.mockReset(); addAuditEntry.mockReset() })

describe("Responsabilidades de cada área", () => {
  it("limita o Financeiro a quatro seções e não repete cadastros ou planejamento", () => {
    render(<FinancialTab />)
    expect(within(screen.getByRole("tablist", { name: "Seções do financeiro" })).getAllByRole("tab").map(t => t.textContent)).toEqual(["A receber", "A pagar", "Movimentações", "Contas bancárias"])
    expect(screen.getByText("Lista de cobranças")).toBeInTheDocument()
    for (const name of ["Clientes", "Fornecedores", "Hóspedes", "Cadastros", "Orçamentos"]) expect(screen.queryByRole("tab", { name })).not.toBeInTheDocument()
    expect(screen.queryByText("Movimento líquido")).not.toBeInTheDocument()
  })
  it("resume somente as movimentações que pertencem ao filtro de período", () => {
    render(<FinancialTab />)
    fireEvent.mouseDown(within(screen.getByRole("tablist", { name: "Seções do financeiro" })).getByRole("tab", { name: "Movimentações" }), { button: 0, ctrlKey: false })
    expect(screen.getAllByText(/300,00/)).toHaveLength(2)
    fireEvent.change(screen.getByLabelText("Movimentações a partir de"), { target: { value: "01/10/2026" } })
    expect(screen.queryByText("Entrada de setembro")).not.toBeInTheDocument()
    expect(screen.getAllByText(/100,00/).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/300,00/)).not.toBeInTheDocument()
  })
  it("mantém pagamento de despesa bloqueado para quem só consulta", () => {
    auth.permissions = ["expenses.read"]
    render(<FinancialTab />)
    expect(screen.getAllByRole("tab")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Pagar" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Nova Despesa" })).not.toBeInTheDocument()
  })
  it("permite planejamento com sua própria permissão sem liberar indicadores", () => {
    auth.permissions = ["budgets.read"]
    expect(canAccessTab("relatorios", auth.can)).toBe(true)
    render(<ReportsTab />)
    expect(screen.getByText("Orçamentos")).toBeInTheDocument()
    expect(screen.queryByText("Indicadores gerenciais")).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Indicadores" })).not.toBeInTheDocument()
  })
  it("cadastros financeiros têm destino próprio sem liberar outras fichas", () => {
    auth.permissions = ["costCenters.read"]
    expect(canAccessTab("cadastros", auth.can)).toBe(true)
    render(<RegistrationsTab />)
    expect(screen.getByRole("tab", { name: "Financeiros" })).toBeInTheDocument()
    expect(screen.getByText("Centros de Custo")).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Pessoas e empresas" })).not.toBeInTheDocument()
  })
  it("preserva consulta de perfis para quem não pode ler o cadastro de pessoas", () => {
    auth.permissions = ["guests.read"]
    expect(canAccessTab("cadastros", auth.can)).toBe(true)
    render(<RegistrationsTab />)
    expect(screen.getByPlaceholderText("Buscar por nome ou CPF")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Novo Hóspede" })).not.toBeInTheDocument()
  })
  it("cria perfil pela ficha da pessoa com identidade preenchida e sem duplicar pessoa", async () => {
    const person = { id: "person", name: "Pessoa Exemplo", cpfCnpj: "52998224725", active: true, createdAt: "", updatedAt: "" }
    render(<GuestsManagement person={person} />)
    fireEvent.click(screen.getByRole("button", { name: "Adicionar perfil de hospedagem" }))
    const dialog = screen.getByRole("dialog")
    const fields = within(dialog).getAllByRole("textbox")
    expect(fields[0]).toHaveValue("Pessoa Exemplo"); expect(fields[0]).toBeDisabled()
    expect(fields[1]).toHaveValue("52998224725"); expect(fields[1]).toBeDisabled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(addGuest).toHaveBeenCalledWith(expect.objectContaining({ customerId: "person", cpf: "52998224725", name: "Pessoa Exemplo" })))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })
})
