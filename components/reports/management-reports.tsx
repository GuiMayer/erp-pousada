"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { businessDay } from "@/lib/utils/business-values";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  reportSections,
  reportAccess,
  type ReportSection,
  type ManagementReport,
  type ReportLine,
  type ReportQuery,
} from "@/lib/reports/management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MetricCard } from "./metric-card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
const names: Record<ReportSection, string> = {
  hospedagem: "Hospedagem",
  bebidas: "Bebidas",
  estoque: "Compras e estoque",
  financeiro: "Fluxo e cobrança",
  resultado: "Resultado gerencial",
};
const labels: Record<string, string> = {
  "diaria-prestada": "Diária prestada",
  "diaria-acordada": "Diária acordada",
  "bebida-pdv": "Venda avulsa",
  "bebida-hospedagem": "Consumo de hospedagem",
  "venda-cancelada": "Venda cancelada",
  "consumo-removido": "Consumo removido",
  "saldo-lote": "Saldo atual do lote",
  compra: "Compra recebida",
  "custo-consumido": "Custo consumido",
  "custo-restituido": "Custo restituído",
  perda: "Perda",
  "ajuste-inventario": "Diferença de inventário",
  "devolucao-fornecedor": "Devolução ao fornecedor",
  "custo-legado": "Custo legado",
  "despesa-gerencial": "Despesa por vencimento",
  "entrada-realizada": "Entrada realizada",
  "saida-realizada": "Saída realizada",
  "movimento-sem-fluxo": "Transferência/crédito sem fluxo",
  "receber-anterior": "A receber anterior",
  "pagar-anterior": "A pagar anterior",
  "receber-previsto": "A receber previsto",
  "pagar-previsto": "A pagar previsto",
  "saldo-conta": "Saldo atual de conta",
  "turno-caixa": "Turno de caixa",
};
const fields: Record<string, string> = {
  id: "Identificador",
  date: "Data",
  value: "Valor",
  total: "Total",
  status: "Situação",
  label: "Descrição",
  name: "Nome",
  description: "Descrição",
  quantity: "Quantidade",
  unit: "Unidade",
  code: "Lote",
  origin: "Origem",
  originType: "Tipo de origem",
  originId: "Identificador de origem",
  productId: "Produto",
  productName: "Bebida",
  supplierName: "Fornecedor",
  receivedAt: "Recebido em",
  dueDate: "Vencimento",
  paidValue: "Valor pago",
  paid: "Quitado",
  currentBalance: "Saldo interno",
  initialBalance: "Saldo inicial",
  sourceStayId: "Hospedagem de origem",
  sourcePurchaseId: "Compra de origem",
  recordVersion: "Versão",
  roomId: "Quarto",
  reservationId: "Reserva",
  guestName: "Hóspede",
  guestCount: "Ocupantes",
  checkIn: "Entrada",
  checkOut: "Saída",
  endedAt: "Encerramento",
  lodgingValue: "Diárias acordadas",
  nightlyPrices: "Preços por noite",
  allocations: "Alocações",
  charges: "Consumos",
  payments: "Pagamentos",
  adjustments: "Ajustes",
  items: "Itens",
  installments: "Parcelas",
  installmentNumber: "Parcela",
  unitPrice: "Preço unitário",
  lineTotal: "Total da linha",
  unitCost: "Custo unitário",
  remainingValue: "Valor restante",
  receivedQuantity: "Quantidade recebida",
  expiresAt: "Validade",
  costEstimated: "Custo estimado",
  paymentMethod: "Meio de pagamento",
  method: "Meio",
  type: "Tipo",
  operator: "Operador",
  responsible: "Responsável",
  createdAt: "Criado em",
  start: "Início",
  end: "Fim",
  openingValue: "Fundo de abertura",
  physicalValue: "Contagem física",
  expectedValue: "Valor esperado",
  divergence: "Divergência",
  freight: "Frete",
  discount: "Desconto",
  subtotal: "Subtotal",
  reason: "Motivo",
  reference: "Referência",
  acceptedPackages: "Embalagens aceitas",
  refusedPackages: "Embalagens recusadas",
  factor: "Unidades por embalagem",
  packagePrice: "Preço por embalagem",
  totalCost: "Custo total",
  baseQuantity: "Quantidade-base",
  packaging: "Embalagem",
  usableQuantity: "Quantidade utilizável",
  overdue: "Vencido",
  position: "Posição",
  category: "Categoria",
  sourceSaleId: "Venda de origem",
  bucket: "Aplicação",
  amountPaid: "Valor oferecido",
  change: "Troco",
  customer: "Cliente",
  cancelReason: "Motivo de cancelamento",
  timestamp: "Data do movimento",
  registeredBy: "Registrado por",
};
function OriginValues({ value }: { value: unknown }) {
  if (Array.isArray(value))
    return (
      <div className="space-y-3">
        {value.length ? (
          value.map((v, i) => (
            <div key={i} className="rounded-md border p-3">
              <OriginValues value={v} />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum item.</p>
        )}
      </div>
    );
  if (value && typeof value === "object")
    return (
      <dl className="space-y-2 text-sm">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="font-medium">
              {fields[k] ?? k.replace(/([A-Z])/g, " $1")}
            </dt>
            <dd className="break-words text-muted-foreground">
              {v && typeof v === "object" ? (
                <OriginValues value={v} />
              ) : v === null || v === undefined ? (
                "Não informado"
              ) : typeof v === "boolean" ? (
                v ? (
                  "Sim"
                ) : (
                  "Não"
                )
              ) : (
                String(v)
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  return <span>{String(value ?? "")}</span>;
}
function DailyChart({ report }: { report: ManagementReport }) {
  const daily = new Map<
    string,
    { date: string; positive: number; negative: number }
  >();
  const positives =
    report.section === "financeiro"
      ? ["entrada-realizada"]
      : report.section === "estoque"
        ? ["compra"]
        : ["diaria-prestada", "bebida-pdv", "bebida-hospedagem"];
  const negatives =
    report.section === "financeiro"
      ? ["saida-realizada"]
      : ["custo-consumido", "custo-restituido", "perda", "despesa-gerencial"];
  for (const row of report.rows) {
    if (!positives.includes(row.kind) && !negatives.includes(row.kind))
      continue;
    const d = daily.get(row.date) ?? {
      date: row.date,
      positive: 0,
      negative: 0,
    };
    if (positives.includes(row.kind))
      d.positive += Math.round((row.value ?? 0) * 100);
    else
      d.negative += Math.round(
        (row.value ?? 0) * (report.section === "financeiro" ? -100 : 100),
      );
    daily.set(row.date, d);
  }
  const data = [...daily.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      positive: d.positive / 100,
      negative: d.negative / 100,
    }));
  if (!data.length) return null;
  const positive =
      report.section === "financeiro"
        ? "Entradas realizadas"
        : report.section === "estoque"
          ? "Compras recebidas"
          : "Prestado/vendido",
    negative =
      report.section === "financeiro"
        ? "Saídas realizadas"
        : "Custos/perdas/despesas";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Valores por dia e origem</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="h-64 min-w-0"
          role="img"
          aria-label={`${positive} e ${negative} por dia; valores detalhados abaixo`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(5)} />
              <YAxis width={54} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Bar
                dataKey="positive"
                name={positive}
                fill="var(--color-primary, #2563eb)"
              />
              <Bar dataKey="negative" name={negative} fill="#d97706" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
export function ReportView({
  report,
  onSource,
}: {
  report: ManagementReport;
  onSource: (row: ReportLine) => void;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [report]);
  const pages = Math.max(1, Math.ceil(report.rows.length / 40));
  return (
    <div className="space-y-4 min-w-0">
      <p className="text-sm text-muted-foreground">
        {report.start} a {report.end} · fim inclusivo · posição gerada em{" "}
        {new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(report.asOf))}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {report.metrics.map((m) => (
          <MetricCard
            key={m.key}
            title={m.label}
            value={m.value}
            format={
              m.unit === "money"
                ? "currency"
                : m.unit === "percent"
                  ? "percentage"
                  : "number"
            }
          />
        ))}
      </div>
      {report.warnings.length > 0 && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-medium">Dados e limites para conferir</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {report.warnings.slice(0, 12).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {report.warnings.length > 12 && (
            <p className="mt-2">
              Outros {report.warnings.length - 12} avisos constam na exportação.
            </p>
          )}
        </div>
      )}
      <details className="rounded-md border p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Como os números são calculados
        </summary>
        <ul className="mt-2 list-disc space-y-2 pl-4">
          {report.criteria.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </details>
      <DailyChart report={report} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          Detalhamento e origem · {report.rows.length} registros
        </h3>
        <p className="text-sm text-muted-foreground">
          Documento gerencial, não fiscal
        </p>
      </div>
      {!report.rows.length && (
        <p className="rounded-md border p-4 text-sm">
          Nenhum documento neste período.
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {report.rows.slice(page * 40, (page + 1) * 40).map((row) => (
          <Card key={`${row.kind}:${row.id}`}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {row.date} · {labels[row.kind] ?? row.kind}
                </span>
                {row.estimated && (
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Estimado
                  </span>
                )}
              </div>
              <p className="break-words font-medium">{row.label}</p>
              <p>
                {row.value === null
                  ? "Valor ausente"
                  : formatCurrency(row.value)}
                {row.quantity !== undefined &&
                  ` · Quantidade: ${row.quantity}${row.details?.unit ? ` ${row.details.unit}` : ""}`}
              </p>
              {row.details && (
                <div className="text-xs text-muted-foreground">
                  {Object.entries(row.details)
                    .filter(([key]) =>
                      [
                        "expiresAt",
                        "usableQuantity",
                        "overdue",
                        "position",
                        "paymentMethod",
                        "status",
                        "divergence",
                      ].includes(key),
                    )
                    .map(([key, v]) => (
                      <p key={key}>
                        {fields[key] ?? key}: {v}
                      </p>
                    ))}
                </div>
              )}
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => onSource(row)}
              >
                Abrir documento de origem
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm">
            {page + 1} de {pages}
          </span>
          <Button
            variant="outline"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
export function ManagementReports() {
  const { user, can } = useAuth();
  const available = reportSections.filter(
    (s) => can("reports.read") && reportAccess[s].every(can),
  );
  const [section, setSection] = useState<ReportSection>(
      available[0] ?? "hospedagem",
    ),
    [start, setStart] = useState(businessDay()),
    [end, setEnd] = useState(businessDay());
  const [query, setQuery] = useState<ReportQuery | null>(null),
    [report, setReport] = useState<ManagementReport | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [exporting, setExporting] = useState(false);
  const [origin, setOrigin] = useState<unknown>(null),
    [originOpen, setOriginOpen] = useState(false),
    [originError, setOriginError] = useState(""),
    [originBusy, setOriginBusy] = useState(false),
    epoch = useRef(0),
    sourceEpoch = useRef(0);
  const access = JSON.stringify([
    user?.id,
    user?.accessVersion,
    user?.permissions,
  ]);
  const load = useCallback(async (q: ReportQuery) => {
    const token = ++epoch.current;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/reports?${new URLSearchParams(q)}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok)
        throw Error(body.error ?? "Falha ao consultar relatório");
      if (token === epoch.current) setReport(body);
    } catch (e) {
      if (token === epoch.current) {
        setReport(null);
        setError((e as Error).message);
      }
    } finally {
      if (token === epoch.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    epoch.current++;
    sourceEpoch.current++;
    setReport(null);
    setQuery(null);
    setOrigin(null);
    setOriginOpen(false);
    setError("");
    setBusy(false);
  }, [access]);
  useEffect(() => {
    if (!query) return;
    void load(query);
    const refresh = () => {
      if (!document.hidden) void load(query);
    };
    window.addEventListener("erp:operation-completed", refresh);
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      // Invalidate a request generation, not a DOM reference.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      epoch.current++;
      clearInterval(timer);
      window.removeEventListener("erp:operation-completed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [query, load]);
  async function download(format: "csv" | "json") {
    if (!report) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({
        section: report.section,
        start: report.start,
        end: report.end,
        format,
      });
      const response = await fetch(`/api/reports?${params}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json();
        throw Error(body.error ?? "Falha ao exportar");
      }
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `gerencial-${report.section}-${report.start}-${report.end}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  async function source(row: ReportLine) {
    if (!report) return;
    const token = ++sourceEpoch.current;
    setOriginOpen(true);
    setOrigin(null);
    setOriginError("");
    setOriginBusy(true);
    try {
      const response = await fetch(
          `/api/reports/source?${new URLSearchParams({ section: report.section, ...row.source })}`,
          { cache: "no-store" },
        ),
        body = await response.json();
      if (!response.ok) throw Error(body.error ?? "Falha ao abrir documento");
      if (token === sourceEpoch.current) setOrigin(body.document);
    } catch (e) {
      if (token === sourceEpoch.current) setOriginError((e as Error).message);
    } finally {
      if (token === sourceEpoch.current) setOriginBusy(false);
    }
  }
  if (!available.length)
    return (
      <p className="rounded-md border p-4">
        Sem acesso aos dados necessários para relatórios gerenciais. O
        administrador pode configurar suas permissões.
      </p>
    );
  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Relatórios da pousada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confira prestação, bebidas, custos e dinheiro pelas suas origens.
        </p>
      </div>
      <form
        className="grid gap-3 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({
            section: available.includes(section) ? section : available[0],
            start,
            end,
          });
        }}
      >
        <div>
          <Label htmlFor="report-section">Relatório</Label>
          <select
            id="report-section"
            value={available.includes(section) ? section : available[0]}
            onChange={(e) => setSection(e.target.value as ReportSection)}
            className="mt-1 min-h-11 w-full rounded-md border bg-background px-2"
          >
            {available.map((s) => (
              <option key={s} value={s}>
                {names[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="report-start">Início</Label>
          <Input
            id="report-start"
            type="date"
            required
            min="2020-01-01"
            value={start}
            onInput={(e) => setStart(e.currentTarget.value)}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 min-h-11"
          />
        </div>
        <div>
          <Label htmlFor="report-end">Fim (inclusive)</Label>
          <Input
            id="report-end"
            type="date"
            required
            min={start}
            value={end}
            onInput={(e) => setEnd(e.currentTarget.value)}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 min-h-11"
          />
        </div>
        <Button className="min-h-11 self-end" type="submit" disabled={busy}>
          Consultar
        </Button>
      </form>
      <div role="status" aria-live="polite">
        {busy && <p className="text-sm">Atualizando relatório…</p>}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-sm text-destructive"
        >
          {error} Os filtros foram preservados; tente consultar novamente.
        </p>
      )}
      {report && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">{names[report.section]}</h3>
            {can("reports.export") && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={busy || exporting}
                  onClick={() => void download("csv")}
                >
                  Exportar CSV
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={busy || exporting}
                  onClick={() => void download("json")}
                >
                  Exportar JSON
                </Button>
              </div>
            )}
          </div>
          <ReportView report={report} onSource={(row) => void source(row)} />
          <p className="text-xs text-muted-foreground">
            Exportações recalculam todos os registros do período e conferem seu
            acesso novamente.
          </p>
        </>
      )}
      <Dialog
        open={originOpen}
        onOpenChange={(open) => {
          setOriginOpen(open);
          if (!open) sourceEpoch.current++;
        }}
      >
        <DialogContent
          mobileTask
          className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle>Documento de origem</DialogTitle>
            <DialogDescription>
              Dados atuais do documento. Os valores do relatório usam os
              critérios e o período exibidos.
            </DialogDescription>
          </DialogHeader>
          {originBusy && <p role="status">Carregando origem…</p>}
          {originError && (
            <p role="alert" className="text-destructive">
              {originError}
            </p>
          )}
          {origin !== null && <OriginValues value={origin} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
