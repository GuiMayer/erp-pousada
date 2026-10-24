import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { POSTab } from "@/components/pos-tab"
import type { StockItem, POSProduct, POSSale } from "@/lib/store"
const state = vi.hoisted(() => ({ products: [] as POSProduct[], sales: [] as POSSale[], runOperation: vi.fn(), toast: vi.fn(), phone: false, stockItems: [] as StockItem[] }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ username: "Ana", role: "supervisor", can: () => true, canRequest: () => true }) }))
vi.mock("@/lib/app-context", () => ({ useApp: () => ({ posProducts: state.products, posSales: state.sales, stays: [], rooms: [], stockItems: state.stockItems, runOperation: state.runOperation, productCategories: [{ id: "drinks", name: "Bebidas", active: true, isRestaurant: false }], cashCloses: [{ id: "cash", status: "aberto" }], bankAccounts: [] }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }))
vi.mock("@/hooks/use-phone-layout", () => ({ usePhoneLayout: () => state.phone }))
vi.mock("@/components/cash-workspace", () => ({ CashWorkspace: () => <p>Controle de caixa</p> }))
beforeEach(() => {
  state.sales = []; state.stockItems = []; state.phone = false; state.runOperation.mockReset(); state.toast.mockReset()
  state.products = [{ id: "water", name: "Água mineral", categoryId: "drinks", price: 5, barcode: "123456", trackStock: false }, { id: "juice", name: "Suco", categoryId: "drinks", price: 8, barcode: "987654", trackStock: false }]
})
describe("Seleção compacta no PDV", () => {
  it("filtra por nome sem incluir automaticamente e adiciona código exato uma única vez", () => {
    render(<POSTab />)
    const search = screen.getByRole("textbox", { name: "Buscar bebida por nome ou código" })
    fireEvent.change(search, { target: { value: "Água" } }); fireEvent.submit(search.closest("form")!)
    expect(screen.getByRole("button", { name: "Pagamento" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Adicionar Suco ao carrinho" })).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: "123456" } }); fireEvent.submit(search.closest("form")!)
    expect(search).toHaveValue("")
    expect(screen.getAllByRole("button", { name: "Aumentar quantidade de Água mineral" })).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Pagamento" })).toBeEnabled()
    fireEvent.keyDown(window, { key: "F2" }); expect(search).toHaveFocus()
    expect(state.runOperation).not.toHaveBeenCalled()
  })
  it("não adiciona código parcial ou ambíguo e não abre confirmação ao tocar na bebida", () => {
    state.products[1].barcode = "123456"
    render(<POSTab />)
    const search = screen.getByRole("textbox", { name: "Buscar bebida por nome ou código" })
    fireEvent.change(search, { target: { value: "123" } }); fireEvent.submit(search.closest("form")!)
    expect(screen.getByRole("button", { name: "Pagamento" })).toBeDisabled()
    fireEvent.change(search, { target: { value: "123456" } }); fireEvent.submit(search.closest("form")!)
    expect(screen.getByRole("button", { name: "Pagamento" })).toBeDisabled()
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Código associado a mais de uma bebida" }))
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Água mineral ao carrinho" }))
    expect(screen.getByRole("button", { name: "Pagamento" })).toBeEnabled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(state.runOperation).not.toHaveBeenCalled()
  })
})


describe("Revisão e quantidade do PDV", () => {
  it("revisa em um único painel no celular e preserva busca e quantidade ao voltar", async () => {
    state.phone = true
    render(<POSTab />)
    const search = screen.getByRole("textbox", { name: "Buscar bebida por nome ou código" })
    fireEvent.change(search, { target: { value: "Água" } })
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Água mineral ao carrinho" }))
    expect(screen.queryByLabelText("Quantidade de Água mineral")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Revisar venda/ }))
    expect(screen.getByRole("dialog", { name: "Revisar venda" })).toBeInTheDocument()
    expect(screen.getAllByLabelText("Quantidade de Água mineral")).toHaveLength(1)
    const quantity = screen.getByLabelText("Quantidade de Água mineral")
    fireEvent.change(quantity, { target: { value: "6" } }); fireEvent.blur(quantity)
    expect(quantity).toHaveValue(6)
    fireEvent.click(screen.getByRole("button", { name: "Voltar aos produtos" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(search).toHaveValue("Água")
    fireEvent.click(screen.getByRole("button", { name: /6 itens.*Revisar venda/ }))
    expect(screen.getByLabelText("Quantidade de Água mineral")).toHaveValue(6)
    expect(state.runOperation).not.toHaveBeenCalled()
  })
  it("a quantidade digitada respeita o estoque e um campo vazio não remove o item", () => {
    state.products[0].trackStock = true
    state.stockItems = [{ id: "stock", productId: "water", productName: "Água", currentStock: 3, minimumStock: 0, maximumStock: 20, averageCost: 1, lastPurchasePrice: 1, unit: "un" }]
    render(<POSTab />)
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Água mineral ao carrinho" }))
    const quantity = screen.getByLabelText("Quantidade de Água mineral")
    fireEvent.change(quantity, { target: { value: "5" } }); fireEvent.blur(quantity)
    expect(quantity).toHaveValue(1)
    expect(state.toast).toHaveBeenCalled()
    fireEvent.change(quantity, { target: { value: "" } }); fireEvent.blur(quantity)
    expect(quantity).toHaveValue(1)
    fireEvent.change(quantity, { target: { value: "3" } }); fireEvent.blur(quantity)
    expect(quantity).toHaveValue(3)
    expect(state.runOperation).not.toHaveBeenCalled()
  })
  it("retorna à revisão após falha e reutiliza a mesma identificação ao confirmar novamente", async () => {
    state.phone = true; state.runOperation.mockRejectedValue(Error("Sem conexão"))
    render(<POSTab />)
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Água mineral ao carrinho" }))
    fireEvent.click(screen.getByRole("button", { name: /Revisar venda/ }))
    fireEvent.click(screen.getByRole("button", { name: "Pagamento" }))
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "Confirmar venda" }))
    await screen.findByRole("alert")
    const requestId = state.runOperation.mock.calls[0][2]
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await screen.findByRole("dialog", { name: "Revisar venda" })
    expect(screen.getByLabelText("Quantidade de Água mineral")).toHaveValue(1)
    fireEvent.click(screen.getByRole("button", { name: "Pagamento" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirmar venda" }))
    await waitFor(() => expect(state.runOperation).toHaveBeenCalledTimes(2))
    expect(state.runOperation.mock.calls[1][2]).toBe(requestId)
  })
})

it("inclui no dia comercial uma venda após meia-noite UTC", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-24T01:00:00Z"))
  try {
    state.sales = [{ id:"sale", date:"2026-10-24T01:00:00Z", status:"concluida", total:5, subtotal:5, discount:0, amountPaid:5, change:0, operator:"Ana", paymentMethod:"PIX", items:[] } as POSSale]
    render(<POSTab />)
    expect(screen.getByText(/1 vendas hoje/)).toHaveTextContent("R$ 5,00")
  } finally { vi.useRealTimers() }
})
