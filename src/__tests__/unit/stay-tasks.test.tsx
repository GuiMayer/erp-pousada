import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StaySheet } from "@/components/stay-sheet";
import { businessDay } from "@/lib/utils/business-values";
import type { Stay } from "@/lib/stays";
import type { LodgingTariff } from "@/lib/lodging-pricing";
import { extensionQuoteSignature } from "@/lib/stay-extension";
const state = vi.hoisted(() => ({
  runOperation: vi.fn(),
  denied: [] as string[],
  tariffs: [] as LodgingTariff[],
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ can: (p: string) => !state.denied.includes(p) }),
}));
vi.mock("@/lib/app-context", () => ({
  useApp: () => ({
    runOperation: state.runOperation,
    rooms: [
      { id: 1, number: "101", type: "casal", status: "ocupado", capacity: 2 },
      {
        id: 2,
        number: "102",
        type: "casal",
        status: "disponivel",
        capacity: 2,
      },
    ],
    customers: [],
    lodgingTariffs: state.tariffs,
    accountsReceivable: [],
    reservations: [],
    bankAccounts: [],
    cashCloses: [],
  }),
}));
const day = businessDay(),
  date = (offset: number) =>
    new Date(Date.parse(day) + offset * 86400000).toISOString().slice(0, 10);
const nights = [0, 1].map((i) => ({
  date: date(i),
  guests: 2,
  pricePerPerson: 100,
  total: 200,
  tariffId: "t",
  tariffVersion: 0,
  tariffName: "Tarifa",
}));
const stay: Stay = {
  id: "s",
  reservationId: "r",
  roomId: 1,
  status: "active",
  recordVersion: 7,
  guestName: "Pessoa",
  guestCount: 2,
  checkIn: day,
  checkOut: date(2),
  lodgingValue: 400,
  nightlyPrices: nights,
  occupants: [
    { id: "o1", name: "Pessoa" },
    { id: "o2", name: "Acompanhante" },
  ],
  allocations: [],
  charges: [],
  payments: [
    { id: "p", value: 100, bucket: "lodging", method: "pix", createdAt: "" },
  ],
};
beforeEach(() => {
  state.denied = [];
  state.runOperation.mockReset();
  state.tariffs = [
    {
      id: "t",
      recordVersion: 0,
      name: "Tarifa",
      roomType: "casal",
      minGuests: 1,
      maxGuests: 2,
      pricePerPerson: 100,
      validFrom: date(-30),
      active: true,
    },
  ];
  vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database");
});
afterEach(() => vi.unstubAllEnvs());
describe("Atendimento abre diretamente na tarefa", () => {
  it("recebimento abre sem outro clique e pagamento parcial volta à mesma conta", async () => {
    const close = vi.fn();
    state.runOperation.mockResolvedValueOnce({
      stay: {
        ...stay,
        recordVersion: 8,
        payments: [
          ...stay.payments,
          {
            id: "new",
            value: 50,
            bucket: "lodging",
            method: "pix",
            createdAt: "",
          },
        ],
      },
    });
    render(<StaySheet stay={stay} initialIntent="payment" onClose={close} />);
    const field = await screen.findByRole("spinbutton", {
      name: "Valor a receber",
    });
    fireEvent.change(field, { target: { value: "50" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar pagamento" }),
    );
    await screen.findByText(
      "Pagamento registrado. O saldo restante continua em aberto.",
    );
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByText(/Saldo a receber:/)).toHaveTextContent("250,00");
    expect(state.runOperation).toHaveBeenCalledWith(
      "stay-receive",
      expect.objectContaining({ stayId: "s", recordVersion: 7, value: 50 }),
    );
  });
  it("troca abre o formulário e não obriga procurar entre seções do extrato", () => {
    render(
      <StaySheet stay={stay} initialIntent="transfer" onClose={() => {}} />,
    );
    expect(
      screen.getByRole("combobox", { name: "Quarto de destino" }),
    ).toBeVisible();
    expect(screen.queryByText("Consumo preservado")).toBeNull();
    expect(
      screen.getByText("Trocar de quarto", { selector: "summary" })
        .parentElement,
    ).toHaveAttribute("open");
  });
  it("falha na prorrogação conserva motivo/data; reenvio usa a prévia e versão revisadas", async () => {
    const close = vi.fn();
    state.runOperation
      .mockRejectedValueOnce(Error("Tarifa alterada"))
      .mockResolvedValueOnce({
        stay: {
          ...stay,
          checkOut: date(3),
          recordVersion: 8,
          lodgingValue: 600,
          nightlyPrices: [...nights, { ...nights[0], date: date(2) }],
        },
      });
    render(<StaySheet stay={stay} initialIntent="extend" onClose={close} />);
    fireEvent.change(screen.getByLabelText("Nova saída"), {
      target: { value: date(3) },
    });
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Pedido do hóspede" },
    });
    fireEvent.click(
      screen.getByLabelText("Confirmo a nova saída e as diárias adicionais"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar prorrogação" }),
    );
    await screen.findByText("Tarifa alterada");
    expect(screen.getByLabelText("Nova saída")).toHaveValue(date(3));
    expect(screen.getByLabelText("Motivo")).toHaveValue("Pedido do hóspede");
    const quote = { total: 200, nights: [{ ...nights[0], date: date(2) }] };
    expect(state.runOperation).toHaveBeenCalledWith("stay-extend", {
      stayId: "s",
      recordVersion: 7,
      checkOut: date(3),
      reason: "Pedido do hóspede",
      quotedTotal: 200,
      quoteSignature: extensionQuoteSignature(quote),
      confirmed: true,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar prorrogação" }),
    );
    await screen.findByText(
      "Estadia prorrogada. As diárias anteriores e os recebimentos foram preservados.",
    );
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByText(/Saldo a receber:/)).toHaveTextContent("500,00");
  });
  it("troca de versão da tarifa exige nova confirmação mesmo com o mesmo preço", async () => {
    const view = render(
      <StaySheet stay={stay} initialIntent="extend" onClose={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText("Nova saída"), {
      target: { value: date(3) },
    });
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Pedido do hóspede" },
    });
    fireEvent.click(
      screen.getByLabelText("Confirmo a nova saída e as diárias adicionais"),
    );
    expect(
      screen.getByRole("button", { name: "Confirmar prorrogação" }),
    ).not.toBeDisabled();
    state.tariffs = [{ ...state.tariffs[0], recordVersion: 1 }];
    view.rerender(
      <StaySheet stay={stay} initialIntent="extend" onClose={() => {}} />,
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText("Confirmo a nova saída e as diárias adicionais"),
      ).not.toBeChecked(),
    );
    expect(
      screen.getByRole("button", { name: "Confirmar prorrogação" }),
    ).toBeDisabled();
    expect(state.runOperation).not.toHaveBeenCalled();
  });
  it("fechar com rascunho pede decisão e permissão revogada não revela o atendimento", async () => {
    const close = vi.fn();
    const view = render(
      <StaySheet stay={stay} initialIntent="occupants" onClose={close} />,
    );
    fireEvent.change(screen.getByLabelText("Nome do ocupante 2"), {
      target: { value: "Novo nome" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fechar atendimento" }));
    await screen.findByText("Há alterações não salvas");
    fireEvent.click(screen.getByRole("button", { name: "Permanecer" }));
    expect(screen.getByLabelText("Nome do ocupante 2")).toHaveValue(
      "Novo nome",
    );
    expect(close).not.toHaveBeenCalled();
    state.denied = ["stays.read"];
    view.rerender(
      <StaySheet stay={stay} initialIntent="occupants" onClose={close} />,
    );
    expect(screen.queryByLabelText("Nome do ocupante 2")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("não tem permissão");
  });
});
