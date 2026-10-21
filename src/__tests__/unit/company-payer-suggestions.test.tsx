import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ReservationsTab } from "@/components/reservations-tab"
import { CheckinModal } from "@/components/checkin-modal"
import { BookingForm } from "@/components/booking-form"
import { ReservationCancellationDialog } from "@/components/reservation-cancellation-dialog"
import { businessDay } from "@/lib/utils/business-values"
import type { Customer, Reservation, Room, Transaction } from "@/lib/store"

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
  transactions: [] as Transaction[], stays: [], bankAccounts: [], cashCloses: [], systemSettings: {checkInTime: "14:00"}, runOperation, findGuest: (cpf: string) => app.guests.find(g => g.cpf === cpf),
}
vi.mock("@/lib/app-context", () => ({ useApp: () => app }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: () => true, username: "Teste" }) }))
vi.mock("@/lib/notification-context", () => ({ useNotifications: () => ({ sendNotification: vi.fn() }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/lib/data/config", () => ({ getDataConfig: () => ({ adapter: "database" }) }))
vi.mock("@/components/reservation-payment-button", () => ({ ReservationPaymentButton: () => null }))
vi.mock("@/components/customer-combobox", () => ({ CustomerCombobox: ({ purpose = "payer", value, onChange }: { purpose?: string; value: string; onChange: (id: string, name: string, person: Customer) => void }) => <select aria-label={purpose === "guest" ? "Selecionar hóspede" : "Selecionar pagador"} value={value ?? ""} onChange={e => { const person = people.find(p => p.id === e.target.value)!; onChange(person.id, person.name, person) }}><option value="">Selecione</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select> }))
beforeEach(() => { runOperation.mockReset(); app.reservations = []; app.rooms = [room]; app.transactions = [] })
describe("Cobrança da empresa ou particular nas novas hospedagens", () => {
  it("oferece pagamento particular somente para pessoa vinculada e redefine ao trocar o CPF", () => {
    render(<ReservationsTab />)
    fireEvent.click(screen.getByRole("button", { name: "Nova Reserva" }))
    fireEvent.change(screen.getByLabelText("Selecionar hóspede"), { target: { value: "person" } })
    expect(screen.getByRole("checkbox", { name: "Pagar por conta própria, fora da empresa" })).not.toBeChecked()
    expect(screen.getAllByText("Empresa A", { selector: "strong" })).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", {name: /Trocar h.spede/})); fireEvent.change(screen.getByLabelText(/Selecionar h.spede/), { target: { value: "other-person" } })
    expect(screen.queryByRole("checkbox", { name: "Pagar por conta própria, fora da empresa" })).not.toBeInTheDocument()
    expect(screen.getByText("Pessoa B", { selector: "strong" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", {name: /Trocar h.spede/})); fireEvent.change(screen.getByLabelText(/Selecionar h.spede/), { target: { value: "person" } })
    expect(screen.getByRole("checkbox", { name: "Pagar por conta própria, fora da empresa" })).not.toBeChecked()
  })
  it("alterna entre empresa e pessoa sem alterar o vínculo e limpa a escolha ao trocar hóspede", () => {
    render(<ReservationsTab />)
    fireEvent.click(screen.getByRole("button", { name: "Nova Reserva" }))
    fireEvent.change(screen.getByLabelText("Selecionar hóspede"), { target: { value: "person" } })
    fireEvent.click(screen.getByRole("checkbox", { name: "Pagar por conta própria, fora da empresa" }))
    expect(screen.getByText("Pessoa A", { selector: "strong" })).toBeInTheDocument()
    expect(people.find(p => p.id === "person")?.companyId).toBe("company")
    fireEvent.click(screen.getByRole("button", {name: /Trocar h.spede/})); fireEvent.change(screen.getByLabelText(/Selecionar h.spede/), { target: { value: "other-person" } })
    expect(screen.queryByRole("checkbox", { name: "Pagar por conta própria, fora da empresa" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", {name: /Trocar h.spede/})); fireEvent.change(screen.getByLabelText(/Selecionar h.spede/), { target: { value: "person" } })
    expect(screen.getByRole("checkbox", { name: "Pagar por conta própria, fora da empresa" })).not.toBeChecked()
  })
  it("entrada sem reserva oferece cobrança particular e não leva a escolha para outra pessoa", async () => {
    render(<CheckinModal room={room} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Selecionar h.spede/), { target: { value: "person" } })
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Pagar por conta própria, fora da empresa" })).not.toBeChecked())
    fireEvent.click(screen.getByRole("checkbox", { name: "Pagar por conta própria, fora da empresa" }))
    expect(screen.getByText("Pessoa A", { selector: "strong" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", {name: /Trocar h.spede/})); fireEvent.change(screen.getByLabelText(/Selecionar h.spede/), { target: { value: "other-person" } })
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Pagar por conta própria, fora da empresa" })).not.toBeInTheDocument())
    expect(screen.getByText("Pessoa B", { selector: "strong" })).toBeInTheDocument()
  })
  it.each([[false, "company"], [true, "person"]])("check-in envia o responsável correto, particular=%s", async (particular, payerId) => {
    const next = new Date(`${businessDay()}T12:00:00`); next.setDate(next.getDate() + 1)
    render(<CheckinModal room={room} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Selecionar hóspede"), { target: { value: "person" } })
    if (particular) fireEvent.click(screen.getByRole("checkbox", { name: "Pagar por conta própria, fora da empresa" }))
    fireEvent.change(screen.getByLabelText(/^Sa.da$/i), { target: { value: businessDay(next) } })
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrada" }))
    await waitFor(() => expect(runOperation).toHaveBeenCalledWith("check-in", expect.objectContaining({ payerId })))
  })
  it("entrada com reserva mantém o pagador gravado mesmo com empresa vinculada diferente", async () => {
    const today = businessDay(), next = new Date(`${today}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
    app.reservations = [{ id: "booking", roomId: 1, roomNumber: "101", cpf: "52998224725", guestName: "Pessoa A", payerId: "other-company", guestCount: 1, totalValue: 120, status: "confirmada", checkIn: today, checkOut: next.toISOString().slice(0, 10) }]
    render(<CheckinModal room={room} open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrada" }))
    await waitFor(() => expect(runOperation).toHaveBeenCalledWith("check-in", expect.objectContaining({ payerId: "other-company", totalValue: 120 })))
  })
})

const booking = (patch: Partial<Reservation> = {}): Reservation => ({ id: "reservation", recordVersion: 3, roomId: 1, roomNumber: "101", cpf: "52998224725", guestName: "Pessoa A", payerId: "company", guestCount: 1, totalValue: 120, status: "confirmada", checkIn: businessDay(), checkOut: new Date(Date.parse(businessDay()) + 86400000).toISOString().slice(0, 10), ...patch })
describe("Atendimento compartilhado", () => {
  it("não exige caixa quando a devolução parcial usa somente o PIX mais recente", async () => {
    app.transactions = [
      {id:"cash",date:"2026-10-21T14:00:00Z",description:"Sinal",refId:"Hospedagem reservation",value:50,type:"receita",paymentMethod:"Dinheiro"},
      {id:"pix",date:"2026-10-21T15:00:00Z",description:"Sinal",refId:"Hospedagem reservation",value:50,type:"receita",paymentMethod:"PIX",accountId:"bank"},
    ]
    render(<ReservationCancellationDialog reservation={booking({ paidValue: 100 })} noShow={false} onClose={vi.fn()} />)
    expect(screen.getByRole("button", { name: /Cancelar e devolver/ })).toBeDisabled()
    fireEvent.click(screen.getByText("Outras tratativas"))
    fireEvent.click(screen.getByLabelText("Devolver apenas parte do valor"))
    fireEvent.change(screen.getByLabelText("Valor a devolver"), {target:{value:"50"}})
    expect(screen.getByRole("button", { name: /Cancelar e devolver/ })).toBeEnabled()
    expect(screen.queryByText("Abra o caixa para realizar a devolução em dinheiro.")).not.toBeInTheDocument()
  })
  it("avisa que o quarto precisa ser liberado e retorna da edição para a entrada com a nova versão", async () => {
    app.rooms = [{ ...room, status: "limpeza" }, { ...room, id: 2, number: "102" }]
    const r = booking()
    runOperation.mockResolvedValueOnce({ ...r, roomId: 2, roomNumber: "102", recordVersion: 4 })
    const onDone = vi.fn()
    render(<BookingForm intent="checkin" reservation={r} onDone={onDone} />)
    expect(screen.getByRole("alert")).toHaveTextContent("em limpeza")
    expect(screen.getByRole("button", { name: "Confirmar entrada" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Editar condições da reserva" }))
    fireEvent.change(screen.getByLabelText("Quarto 1"), { target: { value: "2" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar reserva" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar entrada" })).toBeEnabled())
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrada" }))
    await waitFor(() => expect(runOperation).toHaveBeenLastCalledWith("check-in", expect.objectContaining({ roomId: 2, reservationId: r.id, recordVersion: 4 })))
  })
  it("entra pela reserva em duas ações sem redigitar identidade e envia ID/versão", async () => {
    app.reservations = [booking()]
    render(<ReservationsTab />)
    fireEvent.click(screen.getByRole("button", { name: "Fazer check-in" }))
    expect(screen.queryByLabelText("Selecionar hóspede")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrada" }))
    await waitFor(() => expect(runOperation).toHaveBeenCalledWith("check-in", expect.objectContaining({ reservationId: "reservation", recordVersion: 3, payerId: "company" })))
  })
  it("data futura oferece reserva e preserva pessoa, quarto, quantidade e saída", async () => {
    render(<BookingForm intent="checkin" room={room} onDone={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Selecionar hóspede"), { target: { value: "person" } })
    const start = new Date(Date.parse(businessDay()) + 86400000).toISOString().slice(0, 10)
    const end = new Date(Date.parse(start) + 86400000).toISOString().slice(0, 10)
    fireEvent.change(screen.getByLabelText("Chegada efetiva"), { target: { value: start } })
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: end } })
    expect(screen.getByRole("button", { name: "Confirmar entrada" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Criar reserva para essa data" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reserva" }))
    await waitFor(() => expect(runOperation).toHaveBeenCalledWith("reserve-group", expect.objectContaining({ cpf: "52998224725", checkIn: start, checkOut: end, payerId: "company", rooms: [expect.objectContaining({ roomId: 1, guestCount: 1 })] })))
  })
  it("cancelamento sem sinal aceita motivo opcional e dispensa seleção financeira", async () => {
    render(<ReservationCancellationDialog reservation={booking()} noShow={false} onClose={vi.fn()} />)
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento (opcional)"), { target: { value: "  Mudança de planos  " } })
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }))
    await waitFor(() => expect(runOperation).toHaveBeenCalledWith("cancel-reservation", expect.objectContaining({ recordVersion: 3, cancellationReason: "Mudança de planos" })))
  })
  it("devolve somente o sinal e aceita ausência de motivo", async () => {
    render(<ReservationCancellationDialog reservation={booking({ totalValue: 500, paidValue: 100 })} noShow={false} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /Cancelar e devolver R\$.*100,00/ }))
    await waitFor(() => expect(runOperation).toHaveBeenCalledWith("cancel-reservation", expect.objectContaining({ decision: "refund", cancellationReason: undefined })))
  })
  it("retenção exige justificativa financeira separada do motivo opcional", async () => {
    render(<ReservationCancellationDialog reservation={booking({ paidValue: 100 })} noShow={false} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole("radio", { name: "Não, reter o valor recebido" }))
    fireEvent.click(screen.getByRole("button", { name: /Cancelar e reter/ }))
    expect(runOperation).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("justificativa financeira")
    fireEvent.change(screen.getByLabelText("Justificativa financeira (obrigatória)"), { target: { value: "Retenção acordada" } })
    fireEvent.click(screen.getByRole("button", { name: /Cancelar e reter/ }))
    await waitFor(() => expect(runOperation).toHaveBeenCalledWith("cancel-reservation", expect.objectContaining({ financialReason: "Retenção acordada", cancellationReason: undefined })))
  })
})
