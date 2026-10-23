import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CashWorkspace } from "@/components/cash-workspace"
import { CashSessionPanel } from "@/components/cash-session-panel"
import type { CashClose } from "@/lib/store"
import { canAccessTab } from "@/lib/permissions"

const state = vi.hoisted(() => ({ cashCloses: [] as CashClose[], runOperation: vi.fn(), phone: false, permissions: [] as string[], bankAccounts: [{ id: "bank", name: "Conta", active: true }] }))
vi.mock("@/hooks/use-phone-layout", () => ({ usePhoneLayout: () => state.phone }))
vi.mock("@/lib/app-context", () => ({ useApp: () => state }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: (p: string) => state.permissions.includes(p), user: { id: "operator" } }) }))
beforeEach(() => {
  state.phone = false; cleanup(); vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database"); state.cashCloses = []; state.runOperation.mockReset()
  state.permissions = ["cash.open", "cash.close", "cash.move", "cashCloses.read"]
})
const turn = (): CashClose => ({ id: "turn", recordVersion: 0, status: "aberto", operator: "Ana", responsibleUserId: "operator", date: "2026-01-01T10:00:00Z", openedAt: "2026-01-01T10:00:00Z", openingValue: 20, physicalValue: 0, expectedValue: 20, divergence: 0 })

describe("Operação centralizada do caixa", () => {
  it("oferece abertura quando fechado e fechamento explícito quando aberto", () => {
    const view = render(<CashWorkspace />)
    expect(screen.getByRole("button", { name: "Abrir caixa" })).toBeInTheDocument()
    state.cashCloses = [turn()]; view.rerender(<CashWorkspace />)
    expect(screen.queryByRole("button", { name: "Abrir caixa" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Fechar caixa" }))
    expect(screen.getByLabelText("Valor físico em dinheiro")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Conferir fechamento" })).toBeDisabled()
  })
  it("não oferece fechar turno de outra pessoa sem autorização e avisa turno antigo", () => {
    state.cashCloses = [{ ...turn(), responsibleUserId: "other" }]
    render(<CashWorkspace />)
    expect(screen.queryByRole("button", { name: "Fechar caixa" })).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("dia anterior")
    expect(screen.getByText(/fechamento deve ser feito por Ana/)).toBeInTheDocument()
  })
  it("sugere fundo anterior e exige motivo para alterá-lo", async () => {
    state.cashCloses = [{ ...turn(), status: "fechado", retainedValue: 30 }]
    render(<CashSessionPanel mode="open" />)
    expect(screen.getByLabelText("Fundo inicial em dinheiro")).toHaveValue(30)
    fireEvent.change(screen.getByLabelText("Fundo inicial em dinheiro"), { target: { value: "20" } })
    expect(screen.getByRole("button", { name: "Abrir caixa" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Motivo da alteração do fundo"), { target: { value: "Fundo reduzido para hoje" } })
    fireEvent.click(screen.getByRole("button", { name: "Abrir caixa" }))
    await waitFor(() => expect(state.runOperation).toHaveBeenCalledWith("cash-open", { openingValue: 20, openingReason: "Fundo reduzido para hoje" }))
  })
  it("pede justificativa após diferença e permite recontar sem fechar", async () => {
    state.cashCloses = [turn()]
    state.runOperation.mockResolvedValueOnce({ ...turn(), closingSummary: { methods: [], deferred: { value: 0, count: 0 }, incomingValue: 0, outgoingValue: 0, expectedValue: 20 } })
    render(<CashSessionPanel mode="close" />)
    fireEvent.change(screen.getByLabelText("Valor físico em dinheiro"), { target: { value: "15" } })
    fireEvent.click(screen.getByRole("button", { name: "Conferir fechamento" }))
    await waitFor(() => expect(screen.getByLabelText("Justificativa da diferença")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Confirmar fechamento" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Recontar dinheiro" }))
    expect(screen.getByLabelText("Valor físico em dinheiro")).toHaveValue(null)
    expect(state.runOperation).toHaveBeenCalledTimes(1)
  })
  it("envia fundo zero e depósito escolhido sem perder a contagem", async () => {
    state.cashCloses = [turn()]
    state.runOperation.mockResolvedValueOnce(turn()).mockResolvedValue({ ...turn(), status: "fechado", physicalValue: 20, retainedValue: 0, withdrawnValue: 20 })
    render(<CashSessionPanel mode="close" />)
    fireEvent.change(screen.getByLabelText("Valor físico em dinheiro"), { target: { value: "20" } })
    fireEvent.change(screen.getByLabelText("Fundo para o próximo turno"), { target: { value: "0" } })
    fireEvent.click(screen.getByRole("checkbox", { name: /Já depositei/ }))
    fireEvent.change(screen.getByLabelText("Conta do depósito"), { target: { value: "bank" } })
    fireEvent.click(screen.getByRole("button", { name: "Conferir fechamento" }))
    await screen.findByRole("button", { name: "Confirmar fechamento" }); fireEvent.click(screen.getByRole("button", { name: "Confirmar fechamento" }))
    await waitFor(() => expect(state.runOperation).toHaveBeenCalledWith("cash-close", { recordVersion: 0, sessionId: "turn", physicalValue: 20, retainedValue: 0, withdrawalAccountId: "bank" }))
    expect(screen.getByRole("status")).toHaveTextContent("Fechamento registrado")
  })
  it("não bloqueia o fechamento se a retirada deixar de existir após selecionar depósito", () => {
    state.cashCloses = [turn()]
    render(<CashSessionPanel mode="close" />)
    fireEvent.change(screen.getByLabelText("Valor físico em dinheiro"), { target: { value: "20" } })
    fireEvent.change(screen.getByLabelText("Fundo para o próximo turno"), { target: { value: "0" } })
    fireEvent.click(screen.getByRole("checkbox", { name: /Já depositei/ }))
    fireEvent.change(screen.getByLabelText("Fundo para o próximo turno"), { target: { value: "20" } })
    expect(screen.queryByLabelText("Conta do depósito")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Conferir fechamento" })).toBeEnabled()
  })
  it("não envia fechamento para outro turno aberto enquanto o formulário estava em uso", async () => {
    state.cashCloses = [turn()]
    const view = render(<CashSessionPanel mode="close" />)
    fireEvent.change(screen.getByLabelText("Valor físico em dinheiro"), { target: { value: "20" } })
    state.cashCloses = [{ ...turn(), id: "new-turn" }]; view.rerender(<CashSessionPanel mode="close" />)
    fireEvent.click(screen.getByRole("button", { name: "Conferir fechamento" }))
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("O turno mudou"))
    expect(state.runOperation).not.toHaveBeenCalled()
  })
  it("permite a aba para operar caixa sem vender e não libera o Financeiro por isso", () => {
    const can = (permission: string) => permission === "cash.open"
    expect(canAccessTab("pdv", can)).toBe(true)
    expect(canAccessTab("financeiro", can)).toBe(false)
  })
})

it("mantém fechamento visível no celular e reúne ações secundárias no menu", async () => {
  state.phone = true; state.cashCloses = [turn()]
  const history = vi.fn()
  render(<CashWorkspace onSalesHistory={history} />)
  expect(screen.getByRole("button", { name: "Fechar caixa" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Movimentar" })).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole("button", { name: "Mais ações do caixa" }), { key: "ArrowDown" })
  expect(await screen.findByRole("menuitem", { name: "Movimentar caixa" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("menuitem", { name: "Histórico de vendas" }))
  expect(history).toHaveBeenCalledOnce()
})
