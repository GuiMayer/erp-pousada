import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { RoomGrid } from "@/components/room-grid"
import { businessDay } from "@/lib/utils/business-values"
const state = vi.hoisted(() => ({ day: "" }))
vi.mock("@/contexts/task-drafts-context", async () => { const { useState } = await import("react"); return { useTaskState: (key: string, initial: unknown) => useState(key === "map.selectedDate" ? state.day : initial) } })
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: () => true }) }))
vi.mock("@/lib/app-context", () => ({ useApp: () => ({ rooms: [{ id: 1, number: "101", status: "ocupado", guest: "Pessoa atual" }, { id: 2, number: "102", status: "disponivel" }], reservations: [{ id: "r", roomId: 2, status: "confirmada", guestName: "Pessoa futura", checkIn: state.day, checkOut: "2099-01-01" }], stays: [] }) }))
vi.mock("@/components/room-card", () => ({ RoomCard: ({ room }: { room: { number: string } }) => <p>Cartão {room.number}</p> }))
vi.mock("@/components/manage-rooms-modal", () => ({ ManageRoomsModal: () => null }))
vi.mock("@/components/cash-turn-shortcut", () => ({ CashTurnShortcut: () => <p>Operação de caixa</p> }))
beforeEach(() => { cleanup(); state.day = new Date(Date.parse(businessDay()) + 86400000).toISOString().slice(0, 10) })

describe("Filtros do Mapa futuro", () => {
  it("filtra e busca pelo planejamento, sem usar a ocupação e o hóspede atuais", () => {
    render(<RoomGrid />)
    expect(screen.queryByRole("button", { name: "Limpeza" })).not.toBeInTheDocument()
    expect(screen.queryByText("Operação de caixa")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Disponivel" }))
    expect(screen.getByText("Cartão 101")).toBeInTheDocument()
    expect(screen.queryByText("Cartão 102")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Todos" }))
    fireEvent.change(screen.getAllByLabelText("Buscar quarto ou hóspede")[0], { target: { value: "Pessoa futura" } })
    expect(screen.getByText("Cartão 102")).toBeInTheDocument()
    expect(screen.queryByText("Cartão 101")).not.toBeInTheDocument()
  })
  it("volta ao atendimento atual sem perder o acesso às ações diárias", () => {
    render(<RoomGrid />)
    fireEvent.click(screen.getByRole("button", { name: "Voltar para hoje" }))
    expect(screen.getByRole("button", { name: "Limpeza" })).toBeInTheDocument()
    expect(screen.getByText("Operação de caixa")).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
