import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { POSTab } from "@/components/pos-tab"
import type { POSProduct } from "@/lib/store"
const state = vi.hoisted(() => ({ products: [] as POSProduct[], runOperation: vi.fn(), toast: vi.fn(), phone: false }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ username: "Ana", role: "supervisor", can: () => true, canRequest: () => true }) }))
vi.mock("@/lib/app-context", () => ({ useApp: () => ({ posProducts: state.products, posSales: [], stays: [], rooms: [], stockItems: [], runOperation: state.runOperation, productCategories: [{ id: "drinks", name: "Bebidas", active: true, isRestaurant: false }], cashCloses: [], bankAccounts: [] }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }))
vi.mock("@/hooks/use-phone-layout", () => ({ usePhoneLayout: () => state.phone }))
vi.mock("@/components/cash-workspace", () => ({ CashWorkspace: () => <p>Controle de caixa</p> }))
beforeEach(() => {
  state.phone = false; state.runOperation.mockReset(); state.toast.mockReset()
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
