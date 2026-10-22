import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { HistoryTab } from "@/components/history-tab"
import type { Reservation } from "@/lib/store"
import type { Stay } from "@/lib/stays"

const denied = new Set<string>()
const runOperation = vi.fn()
const app = {
  stays: [] as Stay[], reservations: [] as Reservation[], rooms: [{ id: 1, number: "101" }],
  customers: [{ id: "company", name: "Empresa Água Azul", active: true, roles: ["payer"], cpfCnpj: "11222333000181" }],
  accountsReceivable: [], lodgingTariffs: [], bankAccounts: [], runOperation,
}
vi.mock("@/lib/app-context", () => ({ useApp: () => app }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: (permission: string) => !denied.has(permission) }) }))
function reservation(status: Reservation["status"]): Reservation {
  return { id: status, status, guestName: `Pessoa ${status}`, payerId: "company", roomId: 1, roomNumber: "101", cpf: "", checkIn: "2026-10-01", checkOut: "2026-10-03", totalValue: 200, paidValue: 50, cancellationReason: "Viagem desmarcada", refundedValue: 50 }
}
function stay(status: string): Stay {
  return { id: status, reservationId: status === "closed" ? "checkout" : "checkin", guestName: `Estadia ${status}`, payerId: "company", roomId: 1, guestCount: 1, checkIn: "2026-10-10", checkOut: "2026-10-12", endedAt: status === "closed" ? "2026-10-12T12:00:00Z" : null, status, lodgingValue: 200, recordVersion: 1, occupants: [{ id: "o", name: "Ocupante" }], allocations: [], charges: [{ id: "c", label: "Água mineral", unitPrice: 10, quantity: 1, status: "active", createdAt: "2026-10-10" }], payments: [{ id: "p", bucket: "lodging", value: 50, method: "pix", createdAt: "2026-10-10" }] }
}
beforeEach(() => {
  cleanup(); denied.clear(); runOperation.mockReset()
  app.reservations = [reservation("confirmada"), reservation("checkin"), reservation("checkout"), reservation("cancelada"), reservation("noshow")]
  app.stays = [stay("active"), stay("closed")]
})

describe("Histórico separado da operação", () => {
  it("reúne encerradas, canceladas e ausências sem duplicar a reserva da estadia", () => {
    render(<HistoryTab />)
    for (const name of ["Estadia closed", "Pessoa cancelada", "Pessoa noshow"]) expect(screen.getByText(name)).toBeInTheDocument()
    for (const name of ["Estadia active", "Pessoa confirmada", "Pessoa checkin", "Pessoa checkout"]) expect(screen.queryByText(name)).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Ver detalhes de/ })).toHaveLength(3)
    expect(screen.getByText(/160,00/)).toBeInTheDocument()
  })
  it("busca empresa sem acentos e combina situação e período da entrada", () => {
    render(<HistoryTab />)
    fireEvent.change(screen.getByLabelText("Buscar no histórico"), { target: { value: "agua azul" } })
    expect(screen.getAllByRole("button", { name: /Ver detalhes de/ })).toHaveLength(3)
    fireEvent.change(screen.getByLabelText("Entrada a partir de"), { target: { value: "10/10/2026" } })
    expect(screen.getAllByRole("button", { name: /Ver detalhes de/ })).toHaveLength(1)
    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "cancelada" } })
    expect(screen.getByText("Nenhum registro encontrado no histórico.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }))
    expect(screen.getAllByRole("button", { name: /Ver detalhes de/ })).toHaveLength(3)
  })
  it("valida período invertido e inclui o último dia selecionado", () => {
    render(<HistoryTab />)
    fireEvent.change(screen.getByLabelText("Entrada até"), { target: { value: "01/10/2026" } })
    expect(screen.getAllByRole("button", { name: /Ver detalhes de/ })).toHaveLength(2)
    fireEvent.change(screen.getByLabelText("Entrada a partir de"), { target: { value: "02/10/2026" } })
    expect(screen.getByRole("alert")).toHaveTextContent("data final")
  })
  it("abre extrato completo da encerrada sem oferecer recebimento ou alteração", () => {
    render(<HistoryTab />)
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes de Estadia closed" }))
    expect(screen.getByText(/Água mineral/)).toBeInTheDocument()
    expect(screen.getByText("Recebimentos e crédito aplicado")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Receber valor|Salvar ocupantes|Confirmar check-out/ })).not.toBeInTheDocument()
    expect(runOperation).not.toHaveBeenCalled()
  })
  it("preserva motivo e devolução do cancelamento sem reabrir ações operacionais", () => {
    render(<HistoryTab />)
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes de Pessoa cancelada" }))
    expect(screen.getByText(/Motivo do cancelamento: Viagem desmarcada/)).toBeInTheDocument()
    expect(screen.getByText(/Devolvido:/)).toHaveTextContent("50,00")
    expect(screen.queryByRole("button", { name: /Cancelar reserva|Fazer check-in|Receber hospedagem/ })).not.toBeInTheDocument()
  })
  it("respeita leitura de cada entidade e atualiza a consulta quando o acesso é revogado", () => {
    denied.add("stays.read")
    const view = render(<HistoryTab />)
    expect(screen.queryByText("Estadia closed")).not.toBeInTheDocument()
    expect(screen.getByText("Pessoa checkout")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes de Pessoa cancelada" }))
    denied.add("reservations.read")
    view.rerender(<HistoryTab />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("não tem permissão")
  })
  it("não mostra cancelamentos para quem só pode ler hospedagens", () => {
    denied.add("reservations.read")
    render(<HistoryTab />)
    expect(screen.getAllByRole("button", { name: /Ver detalhes de/ })).toHaveLength(1)
    expect(screen.queryByText("Pessoa cancelada")).not.toBeInTheDocument()
  })
})
