import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ReservationsTab } from "@/components/reservations-tab"
import type { Reservation } from "@/lib/store"

const app = vi.hoisted(() => ({ reservations: [] as Reservation[], rooms: [], customers: [], systemSettings: { checkInTime: "14:00" } }))
vi.mock("@/lib/app-context", () => ({ useApp: () => app }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: () => true }) }))
vi.mock("@/components/booking-form", () => ({ BookingForm: () => null }))
vi.mock("@/components/checkin-modal", () => ({ CheckinModal: () => null }))
vi.mock("@/components/reservation-cancellation-dialog", () => ({ ReservationCancellationDialog: () => null }))
vi.mock("@/components/reservation-payment-button", () => ({ ReservationPaymentButton: () => null }))

function booking(status: Reservation["status"], checkIn = "2099-01-02"): Reservation {
  return { id: status, status, guestName: `Hóspede ${status}`, roomId: 1, roomNumber: "101", cpf: "", checkIn, checkOut: "2099-01-03", totalValue: 100 }
}
beforeEach(() => { cleanup(); app.reservations = [] })

describe("Fila de reservas aguardando chegada", () => {
  it("mantém reservas futuras e atrasadas, excluindo hospedados e registros concluídos", () => {
    app.reservations = [booking("checkin"), booking("checkout"), booking("cancelada"), booking("noshow"), booking("confirmada"), { ...booking("confirmada", "2020-01-01"), id: "atrasada", guestName: "Chegada atrasada" }]
    render(<ReservationsTab />)
    expect(screen.getByText("Hóspede confirmada")).toBeInTheDocument()
    expect(screen.getByText("Chegada atrasada")).toBeInTheDocument()
    for (const status of ["checkin", "checkout", "cancelada", "noshow"]) expect(screen.queryByText(`Hóspede ${status}`)).not.toBeInTheDocument()
    const rows = screen.getAllByRole("row")
    expect(rows[1]).toHaveTextContent("Chegada atrasada")
    expect(screen.queryByText("Hospedagens e cobranças")).not.toBeInTheDocument()
  })
  it("remove a reserva e fecha seus detalhes quando o check-in é sincronizado", () => {
    app.reservations = [booking("confirmada")]
    const view = render(<ReservationsTab />)
    fireEvent.click(screen.getByText("Hóspede confirmada"))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    app.reservations = [{ ...app.reservations[0], status: "checkin" }]
    view.rerender(<ReservationsTab />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByText("Nenhuma reserva aguardando chegada.")).toBeInTheDocument()
  })
})
