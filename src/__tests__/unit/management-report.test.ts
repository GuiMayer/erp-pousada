import { describe, it, expect } from "vitest";
import {
  reportBounds,
  reportQuery,
  reportCSV,
  spreadCents,
  type ManagementReport,
} from "@/lib/reports/management";
describe("Relatórios gerenciais", () => {
  it("limita período e não aceita datas civis inválidas", () => {
    expect(
      reportQuery.safeParse({
        section: "resultado",
        start: "2026-01-01",
        end: "2027-01-02",
      }).success,
    ).toBe(false);
    expect(
      reportQuery.safeParse({
        section: "resultado",
        start: "2026-02-30",
        end: "2026-03-01",
      }).success,
    ).toBe(false);
  });
  it("limita eventos pela meia-noite operacional e fim exclusivo", () => {
    const b = reportBounds({
      section: "financeiro",
      start: "2026-01-01",
      end: "2026-01-01",
    });
    expect(b.gte.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(b.lt.toISOString()).toBe("2026-01-02T03:00:00.000Z");
  });
  it("rateio legado reconcilia centavos sem alterar cobrança", () => {
    expect(spreadCents(100, ["a", "b", "c"]).map((n) => n.value)).toEqual([
      34, 33, 33,
    ]);
  });
  it("CSV protege texto de fórmula e preserva valor numérico negativo e filtros", () => {
    const r: ManagementReport = {
      section: "resultado",
      start: "2026-01-01",
      end: "2026-01-01",
      asOf: "2026-01-02",
      criteria: ["Critério"],
      warnings: ["Estimado"],
      metrics: [],
      rows: [
        {
          id: "a",
          date: "2026-01-01",
          kind: "despesa",
          label: "=HYPERLINK(bad)",
          value: -10,
          source: { collection: "expenses", id: "a" },
        },
      ],
    };
    const csv = reportCSV(r);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"-10"');
    expect(csv).toContain("Estimado");
    expect(csv).toContain("2026-01-01");
  });
});
