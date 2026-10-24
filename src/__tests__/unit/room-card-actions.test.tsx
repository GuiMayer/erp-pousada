import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RoomCard } from "@/components/room-card";
import type { Room } from "@/lib/store";
import type { Stay } from "@/lib/stays";
const state = vi.hoisted(() => ({
  denied: [] as string[],
  stays: [] as Stay[],
  updateRoom: vi.fn(),
  runOperation: vi.fn(),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    can: (p: string) => !state.denied.includes(p),
    username: "teste",
  }),
}));
vi.mock("@/lib/notification-context", () => ({
  useNotifications: () => ({ sendNotification: vi.fn() }),
}));
vi.mock("@/lib/app-context", () => ({
  useApp: () => ({
    stays: state.stays,
    reservations: [],
    runOperation: state.runOperation,
    updateRoom: state.updateRoom,
    addAuditEntry: vi.fn(),
    getConsumption: () => null,
    clearConsumption: vi.fn(),
    getRoomTimeline: () => [],
  }),
}));
vi.mock("@/components/stay-sheet", () => ({
  StaySheet: ({
    initialIntent,
    onClose,
  }: {
    initialIntent: string;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Atendimento">
      <p>{initialIntent}</p>
      <button onClick={onClose}>Fechar tarefa</button>
    </div>
  ),
}));
vi.mock("@/components/checkin-modal", () => ({ CheckinModal: () => null }));
vi.mock("@/components/consumption-sheet", () => ({
  ConsumptionSheet: () => null,
}));
const room = {
  id: 1,
  number: "101",
  type: "casal",
  status: "ocupado",
  capacity: 2,
  guest: "Pessoa com nome muito longo para a tela do celular",
  checkIn: "2026-10-12",
  checkOut: "2026-10-14",
  recordVersion: 3,
} as Room;
const stay: Stay = {
  id: "s",
  reservationId: "r",
  roomId: 1,
  recordVersion: 4,
  guestName: room.guest!,
  guestCount: 2,
  status: "active",
  checkIn: room.checkIn!,
  checkOut: room.checkOut!,
  lodgingValue: 200,
  nightlyPrices: [
    {
      date: "2026-10-12",
      guests: 2,
      pricePerPerson: 100,
      total: 200,
      tariffName: "Atual",
    },
  ],
  occupants: [],
  allocations: [],
  charges: [
    {
      id: "c",
      label: "Água",
      unitPrice: 10,
      quantity: 1,
      status: "active",
      createdAt: "",
    },
  ],
  payments: [],
};
beforeEach(() => {
  state.denied = [];
  state.stays = [stay];
  state.updateRoom.mockReset();
  state.runOperation.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("Cartão compacto do quarto", () => {
  it("substitui botões avulsos por nome e saldo acionáveis sem duplicar bebidas", async () => {
    render(<RoomCard room={room} selectedDate="2026-10-12" />);
    expect(
      screen.queryByRole("button", { name: "Hospedagem / extrato" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Receber pagamento do quarto 101" }),
    ).toHaveTextContent("210,00");
    fireEvent.click(
      screen.getByRole("button", { name: "Receber pagamento do quarto 101" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("payment");
    fireEvent.click(screen.getByText("Fechar tarefa"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir hospedagem do quarto 101" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("overview");
  });
  it("check-out abre sua tarefa e leitura sem recebimento conserva valor sem link", () => {
    state.denied = ["hospitality.receive"];
    render(<RoomCard room={room} selectedDate="2026-10-12" />);
    expect(
      screen.queryByRole("button", { name: "Receber pagamento do quarto 101" }),
    ).toBeNull();
    expect(screen.getByText("Saldo total a receber")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Check-out" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("checkout");
  });
  it("menu abre transferência diretamente e fecha antes de apresentar atendimento", async () => {
    render(<RoomCard room={room} selectedDate="2026-10-12" />);
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Mais ações do quarto 101" }),
      { key: "Enter" },
    );
    const action = await screen.findByRole("menuitem", {
      name: "Trocar de quarto",
    });
    fireEvent.click(action);
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveTextContent("transfer"),
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("saldo quitado não recebe; duplicidade impede escolher uma hospedagem arbitrária", () => {
    state.stays = [
      {
        ...stay,
        payments: [
          {
            id: "p",
            value: 210,
            bucket: "general",
            method: "pix",
            createdAt: "",
          },
        ],
      },
    ];
    const view = render(<RoomCard room={room} selectedDate="2026-10-12" />);
    expect(screen.getByText("Hospedagem quitada")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Receber pagamento do quarto 101" }),
    ).toBeNull();
    state.stays = [stay, { ...stay, id: "another" }];
    view.rerender(<RoomCard room={room} selectedDate="2026-10-12" />);
    expect(screen.getByRole("alert")).toHaveTextContent("revisão");
    expect(screen.getByRole("button", { name: "Check-out" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Mais ações do quarto 101" }),
    ).toBeNull();
  });
});

it("mostra apenas consumo pendente após pagamento parcial e quitação", () => {
  state.stays = [{ ...stay, payments: [{id:"p",value:4,bucket:"consumption",method:"PIX",createdAt:""}] }]
  const view = render(<RoomCard room={room} selectedDate="2026-10-12" />)
  expect(screen.getByText("R$ 6,00")).toBeInTheDocument()
  expect(screen.queryByText("R$ 10,00")).not.toBeInTheDocument()
  state.stays = [{ ...stay, payments: [{id:"p",value:10,bucket:"consumption",method:"PIX",createdAt:""}] }]
  view.rerender(<RoomCard room={room} selectedDate="2026-10-12" />)
  expect(screen.queryByText(/Consumo:/)).not.toBeInTheDocument()
  expect(screen.getByRole("button",{name:"Receber pagamento do quarto 101"})).toHaveTextContent("R$ 200,00")
})
