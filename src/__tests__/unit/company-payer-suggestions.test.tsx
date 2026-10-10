import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ReservationsTab } from "@/components/reservations-tab"
import { CheckinModal } from "@/components/checkin-modal"
import { businessDay } from "@/lib/utils/business-values"
import type { Customer, Reservation, Room } from "@/lib/store"

const people: Customer[] = [
  { id: "company", name: "Empresa A", cpfCnpj: "12ABC34501DE35", roles: ["payer"], active: true, createdAt: "", updatedAt: "" },
  { id: "other-company", name: "Empresa B", cpfCnpj: "11222333000181", roles: ["payer"], active: true, createdAt: "", updatedAt: "" },
  { id: "person", name: "Pessoa A", cpfCnpj: "52998224725", companyId: "company", roles: ["guest", "payer"], active: true, createdAt: "", updatedAt: "" },
  { id: "other-person", name: "Pessoa B", cpfCnpj: "11144477735", roles: ["guest", "payer"], active: true, createdAt: "", updatedAt: "" },
]
const room: Room = { id: 1, number: "101", type: "casal", status: "disponivel", capacity: 2, timeline: [] }
const runOperation = vi.fn()
const app = {
  customers: people, rooms: [room], guests: [{ cpf: "52998224725", customerId: "person", name: "Pessoa A", totalStays: 1, avgTicket: 120, noShows: 0 }],
  reservations: [] as Reservation[], lodgingTariffs: [{ id: "tariff", name: "Padrão", roomType: "casal", minGuests: 1, maxGuests: 2, pricePerPerson: 120, validFrom: "2020-01-01", active: true }],
  runOperation, findGuest: (cpf: string) => app.guests.find(g => g.cpf === cpf),
}
vi.mock("@/lib/app-context", () => ({ useApp: () => app }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: () => true, username: "Teste" }) }))
vi.mock("@/lib/notification-context", () => ({ useNotifications: () => ({ sendNotification: vi.fn() }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/lib/data/config", () => ({ getDataConfig: () => ({ adapter: "database" }) }))
vi.mock("@/components/reservation-payment-button", () => ({ ReservationPaymentButton: () => null }))
vi.mock("@/components/customer-combobox", () => ({ CustomerCombobox: ({ purpose = "payer", value, onChange }: { purpose?: string; value: string; onChange: (id: string, name: string, person: Customer) => void }) => <select aria-label={purpose === "guest" ? "Selecionar hóspede" : "Selecionar pagador"} value={value ?? ""} onChange={e => { const person = people.find(p => p.id === e.target.value)!; onChange(person.id, person.name, person) }}><option value="">Selecione</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select> }))
beforeEach(() => { runOperation.mockReset(); app.reservations = [] })
describe("Sugestão de empresa nas novas hospedagens", () => {
  it("selecionar hóspede ou digitar CPF sugere a empresa na nova reserva", () => {
    render(<ReservationsTab />)
    fireEvent.click(screen.getByRole("button", { name: "Nova Reserva" }))
    fireEvent.change(screen.getByLabelText("Selecionar hóspede"), { target: { value: "person" } })
    expect(screen.getByLabelText("Selecionar pagador")).toHaveValue("company")
    fireEvent.change(screen.getByLabelText("CPF do hóspede"), { target: { value: "11144477735" } })
    expect(screen.getByLabelText("Selecionar pagador")).toHaveValue("other-person")
    fireEvent.change(screen.getByLabelText("CPF do hóspede"), { target: { value: "52998224725" } })
    expect(screen.getByLabelText("Selecionar pagador")).toHaveValue("company")
  })
  it("seleção manual de pagador não é sobrescrita ao mudar o hóspede", () => {
    render(<ReservationsTab />)
    fireEvent.click(screen.getByRole("button", { name: "Nova Reserva" }))
    fireEvent.change(screen.getByLabelText("Selecionar hóspede"), { target: { value: "person" } })
    fireEvent.change(screen.getByLabelText("Selecionar pagador"), { target: { value: "other-company" } })
    fireEvent.change(screen.getByLabelText("Selecionar hóspede"), { target: { value: "other-person" } })
    expect(screen.getByLabelText("Selecionar pagador")).toHaveValue("other-company")
  })
  it("entrada sem reserva sugere a empresa e aceita outro pagador", async () => {
    render(<CheckinModal room={room} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "52998224725" } })
    await waitFor(() => expect(screen.getByLabelText("Selecionar pagador")).toHaveValue("company"))
    fireEvent.change(screen.getByLabelText("Selecionar pagador"), { target: { value: "other-company" } })
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "11144477735" } })
    expect(screen.getByLabelText("Selecionar pagador")).toHaveValue("other-company")
  })
  it("entrada com reserva mantém o pagador gravado mesmo com empresa vinculada diferente", async () => {
    const today = businessDay(), next = new Date(`${today}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
    app.reservations = [{ id: "booking", roomId: 1, roomNumber: "101", cpf: "52998224725", guestName: "Pessoa A", payerId: "other-company", guestCount: 1, totalValue: 120, status: "confirmada", checkIn: today, checkOut: next.toISOString().slice(0, 10) }]
    render(<CheckinModal room={room} open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Confirmar Check-in" }))
    await waitFor(() => expect(runOperation).toHaveBeenCalledWith("check-in", expect.objectContaining({ payerId: "other-company", totalValue: 120 })))
  })
})
