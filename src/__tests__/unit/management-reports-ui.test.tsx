import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  ManagementReports,
  ReportView,
} from "@/components/reports/management-reports";
import type { ManagementReport } from "@/lib/reports/management";
const mocks = vi.hoisted(() => ({
  can: vi.fn((key: string) => Boolean(key)),
  fetch: vi.fn(),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "owner", accessVersion: 1, permissions: [] },
    can: mocks.can,
  }),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Bar: () => null,
}));
const report: ManagementReport = {
  section: "resultado",
  start: "2026-01-01",
  end: "2026-01-01",
  asOf: "2026-01-03T12:00:00Z",
  criteria: ["Recebimento de dívida antiga não eleva prestação."],
  warnings: ["Despesas por vencimento são aproximadas."],
  metrics: [
    {
      key: "provided",
      label: "Hospedagem prestada",
      value: 300,
      unit: "money",
    },
  ],
  rows: [
    {
      id: "stay",
      date: "2026-01-01",
      kind: "diaria-prestada",
      label: "Hóspede",
      value: 300,
      source: { collection: "stays", id: "stay" },
    },
  ],
};
beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.can.mockImplementation(() => true);
  vi.stubGlobal("fetch", mocks.fetch);
});
async function consult() {
  fireEvent.input(screen.getByLabelText("Início"), {
    target: { value: "2026-01-01" },
  });
  fireEvent.input(screen.getByLabelText("Fim (inclusive)"), {
    target: { value: "2026-01-01" },
  });
  fireEvent.submit(screen.getByText("Consultar").closest("form")!);
}
describe("Sprint 5 — relatórios utilizáveis", () => {
  it("mostra valores, critérios, avisos e origem acionável", () => {
    const source = vi.fn();
    render(<ReportView report={report} onSource={source} />);
    expect(screen.getByText("Hospedagem prestada")).toBeInTheDocument();
    expect(
      screen.getByText("Despesas por vencimento são aproximadas."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Abrir documento de origem"));
    expect(source).toHaveBeenCalledWith(report.rows[0]);
    expect(
      screen.getByText("Documento gerencial, não fiscal"),
    ).toBeInTheDocument();
  });
  it("erro não perde datas e não afirma que relatório foi carregado", async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Sessão expirada" }),
    });
    render(<ManagementReports />);
    await consult();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Sessão expirada"),
    );
    expect(screen.getByLabelText("Início")).toHaveValue("2026-01-01");
    expect(screen.queryByText("Hospedagem prestada")).not.toBeInTheDocument();
  });
  it("origem abre com documento atual; acesso à exportação é independente", async () => {
    mocks.can.mockImplementation((key: string) => key !== "reports.export");
    mocks.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => report })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: "stay", guestName: "Pessoa", lodgingValue: 300 },
        }),
      });
    render(<ManagementReports />);
    await consult();
    await screen.findByText("Hospedagem prestada");
    expect(screen.queryByText("Exportar CSV")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Abrir documento de origem"));
    await screen.findByText("Pessoa");
    expect(screen.getByRole("dialog")).toHaveTextContent("Diárias acordadas");
    expect(mocks.fetch.mock.calls[1][0]).toContain("collection=stays");
  });
  it("sem leitura dos dados não oferece relatório indevido", () => {
    mocks.can.mockImplementation((key) => key === "reports.read");
    render(<ManagementReports />);
    expect(
      screen.getByText(/Sem acesso aos dados necessários/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Consultar")).not.toBeInTheDocument();
  });
});
