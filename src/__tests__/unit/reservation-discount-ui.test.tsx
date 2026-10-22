import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ReservationDiscountDialog, ReservationDiscountButton } from "@/components/reservation-discount-dialog"
import type { Reservation } from "@/lib/store"

const state = vi.hoisted(() => ({ adapter: "database", denied: [] as string[] }))
const runOperation = vi.fn(), updateReservation = vi.fn()
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: (p: string) => !state.denied.includes(p) }) }))
vi.mock("@/lib/data/config", () => ({ getDataConfig: () => ({ adapter: state.adapter }) }))
vi.mock("@/lib/app-context", () => ({ useApp: () => ({ runOperation, updateReservation, discountCeiling: 10 }) }))
const reservation: Reservation = { id: "specific", roomId: 2, roomNumber: "102", guestName: "Pessoa", cpf: "", checkIn: "2026-10-22", checkOut: "2026-10-23", status: "confirmada", totalValue: 180, originalValue: 200, paidValue: 50 }
beforeEach(() => { cleanup(); state.adapter = "database"; state.denied = []; runOperation.mockReset(); updateReservation.mockReset() })

describe("Desconto no contexto da reserva e hospedagem", () => {
  it("envia o comando da reserva escolhida e fecha somente após confirmar", async () => {
    const close = vi.fn()
    render(<ReservationDiscountDialog reservation={reservation} onClose={close} />)
    expect(screen.getByText(/Quarto 102 · Reserva specific/)).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Reserva" })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Valor do desconto"), { target: { value: "10" } })
    fireEvent.click(screen.getByRole("button", { name: "Aplicar desconto" }))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(runOperation).toHaveBeenCalledOnce()
    expect(runOperation).toHaveBeenCalledWith("reservation-discount", { reservationId: "specific", type: "percent", value: 10, scope: "total" })
  })
  it("preserva valores digitados se o servidor negar a operação", async () => {
    runOperation.mockRejectedValue(new Error("Operação não autorizada"))
    const close = vi.fn()
    render(<ReservationDiscountDialog reservation={reservation} onClose={close} />)
    fireEvent.change(screen.getByLabelText("Valor do desconto"), { target: { value: "10" } })
    fireEvent.click(screen.getByRole("button", { name: "Aplicar desconto" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("não autorizada")
    expect(screen.getByLabelText("Valor do desconto")).toHaveValue(10)
    expect(close).not.toHaveBeenCalled()
  })
  it("não reduz o contratado abaixo do dinheiro recebido", async () => {
    render(<ReservationDiscountDialog reservation={{ ...reservation, paidValue: 175 }} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText("Valor do desconto"), { target: { value: "10" } })
    fireEvent.click(screen.getByRole("button", { name: "Aplicar desconto" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("abaixo do recebido")
    expect(runOperation).not.toHaveBeenCalled()
  })
  it("usa o desconto acumulado ao exigir autorização na demonstração", () => {
    state.adapter = "demo-localStorage"; state.denied = ["discount.override"]
    render(<ReservationDiscountDialog reservation={reservation} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText("Valor do desconto"), { target: { value: "1" } })
    expect(screen.getByLabelText("Senha do supervisor")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Aplicar desconto" })).toBeDisabled()
    expect(updateReservation).not.toHaveBeenCalled()
  })
  it("multiplica o valor fixo por diária e envia o escopo ao servidor", async () => {
    render(<ReservationDiscountDialog reservation={{ ...reservation, checkOut: "2026-10-25", totalValue: 600, originalValue: 600 }} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText("Aplicar em"), { target: { value: "night" } })
    fireEvent.click(screen.getByRole("radio", { name: "Valor fixo (R$)" }))
    fireEvent.change(screen.getByLabelText("Valor do desconto"), { target: { value: "20" } })
    expect(screen.getByRole("status")).toHaveTextContent(/60,00.*3 diária/)
    expect(screen.getByRole("status")).toHaveTextContent(/540,00/)
    fireEvent.click(screen.getByRole("button", { name: "Aplicar desconto" }))
    await waitFor(() => expect(runOperation).toHaveBeenCalledWith("reservation-discount", { reservationId: "specific", type: "fixed", value: 20, scope: "night" }))
  })
  it("alterna entre fixo e percentual preservando o campo e recalculando a prévia", () => {
    render(<ReservationDiscountDialog reservation={reservation} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText("Valor do desconto"), { target: { value: "10" } })
    expect(screen.getByRole("status")).toHaveTextContent(/162,00/)
    fireEvent.click(screen.getByRole("radio", { name: "Valor fixo (R$)" }))
    expect(screen.getByLabelText("Valor do desconto")).toHaveValue(10)
    expect(screen.getByRole("status")).toHaveTextContent(/170,00/)
  })
  it("esconde o atalho sem permissão ou com hospedagem já encerrada", () => {
    state.denied = ["reservations.discount"]
    const view = render(<ReservationDiscountButton reservation={reservation} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    state.denied = []
    view.rerender(<ReservationDiscountButton reservation={{ ...reservation, status: "checkout" }} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
