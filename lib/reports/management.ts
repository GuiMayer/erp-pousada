import { z } from "zod";
import { businessMonthBounds } from "@/lib/utils/business-values";
export const reportSections = [
  "hospedagem",
  "bebidas",
  "estoque",
  "financeiro",
  "resultado",
] as const;
export type ReportSection = (typeof reportSections)[number];
export const reportAccess: Record<ReportSection, string[]> = {
  hospedagem: ["stays.read", "rooms.read", "reservations.read"],
  bebidas: ["posSales.read", "stays.read"],
  estoque: [
    "stockLots.read",
    "stockMovements.read",
    "purchases.read",
    "stockItems.read",
  ],
  financeiro: [
    "transactions.read",
    "expenses.read",
    "accountsReceivable.read",
    "bankAccounts.read",
    "cashCloses.read",
  ],
  resultado: [
    "stays.read",
    "rooms.read",
    "reservations.read",
    "posSales.read",
    "stockItems.read",
    "stockLots.read",
    "stockMovements.read",
    "purchases.read",
    "expenses.read",
  ],
};
const date = z
  .string()
  .date()
  .refine((d) => d >= "2020-01-01", "Use datas a partir de 2020");
export const reportQuery = z
  .object({ section: z.enum(reportSections), start: date, end: date })
  .strict()
  .refine(
    (q) =>
      q.end >= q.start &&
      (Date.parse(q.end) - Date.parse(q.start)) / 86400000 < 366,
    "Informe período de até 366 dias, com fim após início",
  );
export type ReportQuery = z.infer<typeof reportQuery>;
export type ReportLine = {
  id: string;
  date: string;
  kind: string;
  label: string;
  value: number | null;
  quantity?: number;
  estimated?: boolean;
  source: { collection: string; id: string };
  details?: Record<string, string | number>;
};
export type ManagementReport = {
  section: ReportSection;
  start: string;
  end: string;
  asOf: string;
  criteria: string[];
  warnings: string[];
  metrics: {
    key: string;
    label: string;
    value: number;
    unit: "money" | "number" | "percent";
  }[];
  rows: ReportLine[];
};
export const cents = (n: unknown) => Math.round(Number(n) * 100);
export const money = (n: number) => n / 100;
export function calendarDays(start: string, endExclusive: string) {
  const count = (Date.parse(endExclusive) - Date.parse(start)) / 86400000;
  if (count < 0 || count > 3660)
    throw new Error("Período de hospedagem inválido");
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10),
  );
}
export const nextDay = (day: string) =>
  new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
export function reportBounds(q: ReportQuery) {
  const midnight = (day: string) => {
    const month = businessMonthBounds(day).start;
    return new Date(month.getTime() + (Number(day.slice(8)) - 1) * 86400000);
  };
  return { gte: midnight(q.start), lt: midnight(nextDay(q.end)) };
}
/** Historical total allocation reconciles cents without altering the agreed charge. */
export function spreadCents(total: number, days: string[]) {
  const base = Math.floor(total / days.length);
  return days.map((date, i) => ({
    date,
    value: base + (i < total - base * days.length ? 1 : 0),
  }));
}
export function reportCSV(report: ManagementReport) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (typeof v !== "number" && /^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const rows: unknown[][] = [
    ["Relatório gerencial não fiscal", report.section],
    ["Início", report.start],
    ["Fim inclusivo", report.end],
    ["Gerado em", report.asOf],
    ["Critérios", report.criteria.join(" | ")],
    ["Avisos", report.warnings.join(" | ")],
    ...report.metrics.map((m) => [m.label, m.value, m.unit]),
    [],
    [
      "Data",
      "Tipo",
      "Descrição",
      "Quantidade",
      "Valor (R$)",
      "Estimado",
      "Coleção de origem",
      "Identificador",
      "Detalhes",
    ],
    ...report.rows.map((r) => [
      r.date,
      r.kind,
      r.label,
      r.quantity ?? "",
      r.value ?? "",
      r.estimated ? "Sim" : "Não",
      r.source.collection,
      r.source.id,
      JSON.stringify(r.details ?? {}),
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
}
