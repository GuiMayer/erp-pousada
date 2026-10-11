"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { ManagementReport } from "@/lib/reports/management";
import { formatCurrency } from "@/lib/utils/formatters";
import { Button } from "./ui/button";
import { OriginValues } from "./document-values";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Input } from "./ui/input";
type Forecast = ManagementReport & {
  accounts: { id: string; name: string }[];
  selected: string[];
  cash: "0" | "1";
};
export function FinancialForecast() {
  const { user, can } = useAuth(),
    [days, setDays] = useState(30),
    [selected, setSelected] = useState<string[] | null>(null),
    [cash, setCash] = useState(false),
    [query, setQuery] = useState<{
      days: number;
      accounts: string[] | null;
      cash: boolean;
    } | null>(null),
    [data, setData] = useState<Forecast | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [tick, setTick] = useState(0),
    [origin, setOrigin] = useState<unknown>(null),
    [originOpen, setOriginOpen] = useState(false),
    epoch = useRef(0);
  const access = JSON.stringify([
    user?.id,
    user?.accessVersion,
    user?.permissions,
  ]);
  useEffect(() => {
    epoch.current++;
    setOrigin(null);
    setOriginOpen(false);
    setData(null);
    setSelected(null);
    setQuery(null);
    setError("");
  }, [access]);
  useEffect(() => {
    if (!query) return;
    let active = true;
    setBusy(true);
    setError("");
    const params = new URLSearchParams({
      days: String(query.days),
      cash: query.cash ? "1" : "0",
    });
    if (query.accounts !== null)
      params.set("accounts", query.accounts.join(","));
    fetch(`/api/forecast?${params}`, { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error ?? "Consulta indisponível");
        if (active) {
          setData(b);
          setPage(1);
        }
      })
      .catch((e) => {
        if (active) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [query, access, tick]);
  useEffect(() => {
    const update = () => setTick((v) => v + 1);
    window.addEventListener("erp:operation-completed", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("erp:operation-completed", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  async function download(format: "csv" | "json") {
    if (!query || !data) return;
    const token = epoch.current;
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({
          days: String(query.days),
          cash: query.cash ? "1" : "0",
          accounts: data.selected.join(","),
          format,
        }),
        r = await fetch(`/api/forecast?${params}`, { cache: "no-store" });
      if (!r.ok) throw Error((await r.json()).error);
      const blob = await r.blob();
      if (token !== epoch.current) return;
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `projecao-${data.start}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function source(collection: string, id: string) {
    const token = ++epoch.current;
    setOrigin(null);
    setOriginOpen(true);
    setError("");
    try {
      const r = await fetch(
          `/api/forecast/source?${new URLSearchParams({ collection, id })}`,
          { cache: "no-store" },
        ),
        b = await r.json();
      if (!r.ok) throw Error(b.error);
      if (token === epoch.current) setOrigin(b.document);
    } catch (e) {
      if (token === epoch.current) setError((e as Error).message);
    }
  }
  const rows = data?.rows ?? [],
    visible = rows.slice((page - 1) * 40, page * 40);
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">Projeção financeira a partir de hoje</h3>
      <p className="text-sm text-muted-foreground">
        Saldo interno e títulos previstos; reservas ficam em cenário separado.
        Valores em cartão não comprovam repasse.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          Dias (1–90)
          <Input
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={cash}
            onChange={(e) => setCash(e.target.checked)}
          />
          Incluir caixa aberto
        </label>
        <Button
          disabled={busy || days < 1 || days > 90}
          onClick={() => setQuery({ days, accounts: selected, cash })}
        >
          {busy ? "Consultando…" : "Consultar projeção"}
        </Button>
      </div>
      <p role="status">{error}</p>
      {data && (
        <>
          <p className="text-sm text-muted-foreground">
            Consulta de{" "}
            {new Date(data.asOf).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}{" "}
            · período {data.start} a {data.end}. Alterações de contas, caixa ou
            horizonte serão aplicadas ao consultar novamente.
          </p>
          <fieldset className="flex flex-wrap gap-3">
            <legend>Contas para a próxima consulta</legend>
            {data.accounts.map((a) => (
              <label key={a.id} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={(selected ?? data.selected).includes(a.id)}
                  onChange={(e) => {
                    const current = selected ?? data.selected;
                    setSelected(
                      e.target.checked
                        ? [...current, a.id]
                        : current.filter((id) => id !== a.id),
                    );
                  }}
                />
                {a.name}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.metrics.map((m) => (
              <p key={m.key}>
                {m.label}: <strong>{formatCurrency(m.value)}</strong>
              </p>
            ))}
          </div>
          <details>
            <summary className="min-h-11 cursor-pointer">
              Critérios e avisos da consulta
            </summary>
            {[...data.criteria, ...data.warnings].map((t) => (
              <p key={t} className="text-sm mb-2">
                {t}
              </p>
            ))}
          </details>
          {can("reports.export") && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => download("csv")}
              >
                Exportar CSV
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => download("json")}
              >
                Exportar JSON
              </Button>
            </div>
          )}
          {visible.map((r) => (
            <article key={r.id} className="rounded border p-3">
              <p className="font-medium">
                {r.date} · {r.label}
              </p>
              <p>
                {r.kind === "reserva-cenario" ||
                r.kind === "reserva-sem-previsao"
                  ? "Cenário comercial separado"
                  : r.kind.includes("vencido")
                    ? "Vencido separado"
                    : r.kind === "saldo-projetado"
                      ? "Saldo acumulado"
                      : "Título previsto"}{" "}
                · {formatCurrency(r.value ?? 0)}
              </p>
              {r.details?.incoming !== undefined && (
                <p className="text-sm">
                  Entradas {formatCurrency(Number(r.details.incoming))} · saídas{" "}
                  {formatCurrency(Number(r.details.outgoing))}
                </p>
              )}
              {r.details?.criterion && (
                <p className="text-sm">{r.details.criterion}</p>
              )}
              {r.kind !== "saldo-projetado" && (
                <Button
                  variant="outline"
                  onClick={() => source(r.source.collection, r.source.id)}
                >
                  Abrir documento de origem
                </Button>
              )}
            </article>
          ))}
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span>Página {page}</span>
            <Button
              variant="outline"
              disabled={page * 40 >= rows.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      )}
      <Dialog
        open={originOpen}
        onOpenChange={(open) => {
          epoch.current++;
          setOriginOpen(open);
          if (!open) setOrigin(null);
        }}
      >
        <DialogContent mobileTask className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documento de origem</DialogTitle>
            <DialogDescription>
              Estado atual do documento; pode diferir da consulta anterior.
            </DialogDescription>
          </DialogHeader>
          {origin !== null ? (
            <OriginValues value={origin} />
          ) : (
            <p role="status">{error || "Consultando…"}</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
