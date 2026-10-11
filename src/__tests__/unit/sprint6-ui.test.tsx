import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InitialImport } from "@/components/initial-import";
import { PersonDossier } from "@/components/person-dossier";
import { FinancialForecast } from "@/components/financial-forecast";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  user: { id: "person", accessVersion: 1, permissions: [] as string[] },
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: mocks.user, can: () => false }),
}));
vi.mock("@/lib/data/config", () => ({
  getDataConfig: () => ({ adapter: "database" }),
}));
vi.mock("@/components/stay-sheet", () => ({ StayButton: () => null }));
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
const preview = {
  id: "same-receipt",
  kind: "people",
  state: "preview",
  hash: "hash",
  expiresAt: "2026-11-01T12:00:00Z",
  rows: [{ line: 2, label: "Exemplo", state: "new" }],
};
beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.user = { id: "person", accessVersion: 1, permissions: [] };
  vi.stubGlobal("fetch", mocks.fetch);
});
async function upload() {
  const file = new File(
    [
      "nome;documento;papeis;telefone;email;empresa\nExemplo;11144477735;hospede;;;",
    ],
    "example.csv",
    { type: "text/csv" },
  );
  Object.defineProperty(file, "arrayBuffer", {
    value: async () =>
      new TextEncoder().encode(
        "nome;documento;papeis;telefone;email;empresa\nExemplo;11144477735;hospede;;;",
      ).buffer,
  });
  fireEvent.change(screen.getByLabelText("Arquivo de importação"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(screen.getByText("Conferir prévia")).toBeEnabled(),
  );
  fireEvent.click(screen.getByText("Conferir prévia"));
  await screen.findByText(/Linha 2/);
}
describe("S6 — revisão, falha e acesso na interface", () => {
  it("recebimento perto da virada UTC mostra o dia da pousada", async () => {
    mocks.fetch.mockResolvedValue(
      response({
        access: { stays: true, titles: true, receipts: true },
        summary: { pending: 350, settled: 250, titles: 1 },
        credit: 0,
        rows: [
          {
            id: "receipt",
            description: "Recebimento",
            date: "2026-10-11T01:30:00Z",
            type: "receita",
            value: "250",
            personValue: 250,
          },
        ],
        page: 1,
        total: 1,
      }),
    );
    render(<PersonDossier id="person" />);
    await screen.findByText("Recebimento");
    fireEvent.click(screen.getByText("Recebimentos e estornos"));
    await screen.findByText(/2026-10-10 · receita/);
    expect(screen.queryByText(/2026-10-11 · receita/)).not.toBeInTheDocument();
  });
  it("rejeição impede confirmar mesmo depois de marcar revisão", async () => {
    mocks.fetch.mockResolvedValue(
      response({
        ...preview,
        rows: [
          {
            line: 2,
            label: "Exemplo",
            state: "invalid",
            error: "Documento inválido",
          },
        ],
      }),
    );
    render(<InitialImport />);
    await upload();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Confirmar importação")).toBeDisabled();
    expect(
      screen.getByText("Rejeitado: Documento inválido"),
    ).toBeInTheDocument();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("resposta perdida conserva recibo para repetir a confirmação", async () => {
    mocks.fetch
      .mockResolvedValueOnce(response(preview))
      .mockRejectedValueOnce(Error("Sem resposta do servidor"))
      .mockResolvedValueOnce(response({ created: 1, ignored: 0 }));
    render(<InitialImport />);
    await upload();
    expect(screen.getByText("Confirmar importação")).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("Confirmar importação"));
    await screen.findByText("Sem resposta do servidor");
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.click(screen.getByText("Confirmar importação"));
    await screen.findByText(/Importação concluída/);
    const confirmations = mocks.fetch.mock.calls
      .slice(1)
      .map((call) => JSON.parse(call[1].body));
    expect(confirmations).toEqual(
      Array(2).fill({
        action: "confirm",
        data: { id: "same-receipt", confirmed: true },
      }),
    );
  });
  it("mudança de usuário descarta prévia pendente e recusa resposta antiga", async () => {
    let finish!: (v: unknown) => void;
    mocks.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<InitialImport />);
    const file = new File(["example"], "example.csv");
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode("example").buffer,
    });
    fireEvent.change(screen.getByLabelText("Arquivo de importação"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(screen.getByText("Conferir prévia")).toBeEnabled(),
    );
    fireEvent.click(screen.getByText("Conferir prévia"));
    mocks.user = { ...mocks.user, id: "new-owner", accessVersion: 2 };
    view.rerender(<InitialImport />);
    finish(response(preview));
    await waitFor(() =>
      expect(screen.getByText("Conferir prévia")).toBeDisabled(),
    );
    expect(screen.queryByText(/Linha 2/)).not.toBeInTheDocument();
  });
  it("ficha indisponível não afirma saldo zero ou ausência financeira", async () => {
    mocks.fetch.mockResolvedValue(
      response({
        access: { stays: false, titles: false, receipts: false },
        summary: null,
        credit: null,
        rows: [],
        page: 1,
        total: 0,
      }),
    );
    render(<PersonDossier id="person" />);
    await screen.findByText(
      "Resumo de cobranças indisponível para seu acesso.",
    );
    expect(screen.queryByText(/Saldo pendente/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Nenhum registro nesta parte da ficha."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Esta parte da ficha está indisponível para seu acesso.",
      ),
    ).toBeInTheDocument();
  });
  it("erro de projeção preserva horizonte para nova tentativa", async () => {
    mocks.fetch
      .mockResolvedValueOnce(response({ error: "Sem conexão" }, false))
      .mockResolvedValueOnce(
        response({
          start: "2026-10-11",
          end: "2026-10-17",
          asOf: "2026-10-11T12:00:00Z",
          accounts: [],
          selected: [],
          metrics: [],
          criteria: [],
          warnings: [],
          rows: [],
        }),
      );
    render(<FinancialForecast />);
    fireEvent.change(screen.getByLabelText("Dias (1–90)"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByText("Consultar projeção"));
    await screen.findByText("Sem conexão");
    expect(screen.getByLabelText("Dias (1–90)")).toHaveValue(7);
    fireEvent.click(screen.getByText("Consultar projeção"));
    await screen.findByText("Contas para a próxima consulta");
    expect(
      screen.getByText(/período 2026-10-11 a 2026-10-17/),
    ).toBeInTheDocument();
    expect(mocks.fetch.mock.calls.map((c) => String(c[0]))).toEqual([
      "/api/forecast?days=7&cash=0",
      "/api/forecast?days=7&cash=0",
    ]);
  });
});
