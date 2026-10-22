import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { FinancialCadastrosManagement } from "@/components/financial-cadastros-management"

const auth = vi.hoisted(() => ({ permissions: [] as string[], can: (p: string): boolean => auth.permissions.includes(p) }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: auth.can }) }))
vi.mock("@/lib/app-context", () => ({ useApp: () => ({
  bankAccounts: [{ id: "bank", name: "Conta de teste", currentBalance: 100, active: true }], bankTransfers: [], costCenters: [], budgets: [], recurringTransactions: [],
}) }))
beforeEach(() => { cleanup(); auth.permissions = ["bankAccounts.read", "bankTransfers.read", "costCenters.read", "budgets.read", "recurringTransactions.read"] })

describe("Separação dos recursos financeiros", () => {
  it("renderiza apenas o recurso solicitado, mantendo planejamento fora de contas", () => {
    render(<FinancialCadastrosManagement sections={["bankAccount", "bankTransfer"]} balancesOnly />)
    expect(screen.getByText("Saldos das contas")).toBeInTheDocument()
    expect(screen.getByText("Conta de teste")).toBeInTheDocument()
    for (const name of ["Orcamentos", "Recorrencias", "Centros de Custo"]) expect(screen.queryByText(name)).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Editar cadastro")).not.toBeInTheDocument()
  })
  it("não oferece escrita para quem só consulta os cadastros", () => {
    render(<FinancialCadastrosManagement sections={["bankAccount"]} />)
    expect(screen.getByLabelText("Editar cadastro")).toBeDisabled()
    expect(screen.getByLabelText("Excluir cadastro")).toBeDisabled()
    expect(screen.getAllByRole("button")).toHaveLength(2)
  })
  it("oculta recursos sem a permissão de leitura, mesmo quando solicitados pelo pai", () => {
    auth.permissions = []
    render(<FinancialCadastrosManagement sections={["bankAccount", "bankTransfer", "costCenter", "budget", "recurringTransaction"]} />)
    expect(screen.queryByText("Conta de teste")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
  it("transferência exige sua permissão operacional sem liberar cadastro de contas", () => {
    auth.permissions = ["bankAccounts.use", "bankAccounts.transfer"]
    render(<FinancialCadastrosManagement sections={["bankAccount", "bankTransfer"]} balancesOnly />)
    expect(screen.getByText("Transferencias")).toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(screen.queryByText("Saldos das contas")).not.toBeInTheDocument()
  })
})
