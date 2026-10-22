import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { RoomCard } from "@/components/room-card"
import { businessDay } from "@/lib/utils/business-values"
import type { Reservation, Room } from "@/lib/store"
import type { Stay } from "@/lib/stays"
const state = vi.hoisted(() => ({ denied: [] as string[], reservations: [] as Reservation[], stays: [] as Stay[], runOperation: vi.fn(), updateRoom: vi.fn() }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: (p: string) => !state.denied.includes(p) }) }))
vi.mock("@/lib/app-context", () => ({ useApp: () => ({ ...state, customers: [], getRoomTimeline: () => [] }) }))
vi.mock("@/components/booking-form", () => ({ BookingForm: (props: { intent: string; initialArrival: string; room: Room }) => <p>Formulário {props.intent} · {props.initialArrival} · {props.room.number}</p> }))
vi.mock("@/components/stay-sheet", () => ({ StaySheet: ({ readOnly }: { readOnly?: boolean }) => <div role="dialog">Extrato {readOnly ? "somente consulta" : "operacional"}</div> }))
const future = () => new Date(Date.parse(businessDay()) + 3 * 86400000).toISOString().slice(0, 10)
const room: Room = { id: 1, number: "101", type: "Standard", status: "ocupado", guest: "Hóspede de hoje", checkOut: businessDay(), capacity: 2, timeline: [] }
beforeEach(() => { cleanup(); state.denied = []; state.reservations = []; state.stays = []; state.runOperation.mockReset(); state.updateRoom.mockReset() })
const forbidden = /^(Check-in|Check-out|Consumo|Bloquear|Liberar quarto|Desbloquear quarto|Receber pagamento|Prorrogar estadia|Trocar de quarto|Editar ocupantes)$/

describe("Ações do Mapa em datas futuras", () => {
  it("oferece reserva na data selecionada mesmo com quarto ocupado hoje, sem ações operacionais", () => {
    render(<RoomCard room={room} selectedDate={future()} />)
    expect(screen.queryByText("Hóspede de hoje")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: forbidden })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Reservar" }))
    expect(screen.getByText(`Formulário reservation · ${future()} · 101`)).toBeInTheDocument()
    expect(state.runOperation).not.toHaveBeenCalled(); expect(state.updateRoom).not.toHaveBeenCalled()
  })
  it("abre somente a reserva que cobre o dia, sem oferecer check-in ou nova reserva", () => {
    state.reservations = [{ id: "future", roomId: 1, roomNumber: "101", status: "confirmada", guestName: "Hóspede futuro", checkIn: future(), checkOut: "2099-01-01", cpf: "", totalValue: 100 }]
    render(<RoomCard room={room} selectedDate={future()} />)
    expect(screen.getByText("Reservado")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reservar" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ver reserva" }))
    expect(screen.getByRole("dialog")).toHaveTextContent("Hóspede futuro")
    expect(screen.queryByRole("button", { name: forbidden })).not.toBeInTheDocument()
  })
  it("mantém bloqueio sem prazo como consulta sem permitir desbloqueio antecipado", () => {
    render(<RoomCard room={{ ...room, status: "bloqueado", blockReason: "Reforma" }} selectedDate={future()} />)
    fireEvent.click(screen.getByRole("button", { name: "Ver bloqueio" }))
    expect(screen.getByRole("dialog")).toHaveTextContent("Sem previsão de liberação")
    expect(screen.queryByRole("button", { name: forbidden })).not.toBeInTheDocument()
    expect(state.updateRoom).not.toHaveBeenCalled()
  })
  it("consulta hospedagem prevista em modo de leitura sem recebimentos ou consumo", () => {
    state.stays = [{ id: "s", roomId: 1, status: "active", guestName: "Pessoa prevista", allocations: [{ roomId: 1, start: future(), end: "2099-01-01" }] } as Stay]
    render(<RoomCard room={room} selectedDate={future()} />)
    fireEvent.click(screen.getByRole("button", { name: "Ver hospedagem" }))
    expect(screen.getByRole("dialog")).toHaveTextContent("somente consulta")
    expect(screen.queryByRole("button", { name: forbidden })).not.toBeInTheDocument()
  })
  it("não ganha permissão de reserva por ter check-in e não revela dados sem leitura", () => {
    state.denied = ["reservations.create", "reservations.read", "stays.read"]
    state.reservations = [{ id: "private", roomId: 1, guestName: "Nome restrito", status: "confirmada", checkIn: future(), checkOut: "2099-01-01" } as Reservation]
    render(<RoomCard room={room} selectedDate={future()} />)
    expect(screen.queryByRole("button", { name: "Reservar" })).not.toBeInTheDocument()
    expect(screen.queryByText("Nome restrito")).not.toBeInTheDocument()
    expect(screen.getByText("Disponibilidade a confirmar")).toBeInTheDocument()
  })
})
