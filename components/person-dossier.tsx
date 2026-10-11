"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/utils/formatters";
import { businessDay } from "@/lib/utils/business-values";
import type { Stay } from "@/lib/stays";
import { StayButton } from "./stay-sheet";
import { Button } from "./ui/button";
type Row = {
  id: string;
  description?: string;
  guestName?: string;
  status?: string;
  value?: string;
  paidValue?: string;
  personValue?: number;
  date?: string;
  dueDate?: string;
  paymentMethod?: string;
  type?: string;
  sourceStayId?: string;
  sourceStay?: Stay;
  reversalOfId?: string;
  installments?: {
    id: string;
    dueDate: string;
    value: string;
    paidValue: string;
  }[];
};
type Dossier = {
  access: Record<string, boolean>;
  summary: { pending: number; settled: number; titles: number } | null;
  credit: number | null;
  rows: Row[];
  page: number;
  total: number;
};
export function PersonDossier({ id }: { id: string }) {
  const { user } = useAuth(),
    [section, setSection] = useState("stays"),
    [page, setPage] = useState(1),
    [data, setData] = useState<Dossier | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const access = JSON.stringify([
    user?.id,
    user?.accessVersion,
    user?.permissions,
  ]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    setBusy(true);
    fetch(
      `/api/people?${new URLSearchParams({ id, section, page: String(page) })}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error ?? "Consulta indisponível");
        if (active) setData(body);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [id, section, page, access, refresh]);
  useEffect(() => {
    const update = () => setRefresh((v) => v + 1);
    window.addEventListener("erp:operation-completed", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("erp:operation-completed", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[
          ["stays", "Hospedagens"],
          ["titles", "Cobranças"],
          ["receipts", "Recebimentos e estornos"],
        ].map(([key, label]) => (
          <Button
            key={key}
            variant={section === key ? "secondary" : "outline"}
            onClick={() => {
              setSection(key);
              setPage(1);
            }}
          >
            {label}
          </Button>
        ))}
        <Button variant="outline" onClick={() => setRefresh((v) => v + 1)}>
          Atualizar
        </Button>
      </div>
      <p role="status">{busy ? "Consultando ficha…" : error}</p>
      {data && (
        <>
          {data.summary ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <p>
                Saldo pendente:{" "}
                <strong>{formatCurrency(data.summary.pending)}</strong>
              </p>
              <p>
                Liquidado nos títulos:{" "}
                <strong>{formatCurrency(data.summary.settled)}</strong>
              </p>
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Liquidação pode incluir crédito interno. Recebimentos de
                dinheiro e estornos estão separados no histórico.
              </p>
            </div>
          ) : (
            <p>Resumo de cobranças indisponível para seu acesso.</p>
          )}
          <p>
            {data.credit === null
              ? "Crédito pessoal indisponível para seu acesso."
              : `Crédito pessoal desta identidade: ${formatCurrency(data.credit)} · não transferido para a empresa vinculada.`}
          </p>
          {!data.access[section] ? (
            <p>Esta parte da ficha está indisponível para seu acesso.</p>
          ) : !data.rows.length ? (
            <p>Nenhum registro nesta parte da ficha.</p>
          ) : (
            data.rows.map((row) => (
              <article key={row.id} className="rounded-lg border p-3 space-y-2">
                <p className="font-medium">
                  {row.description ?? row.guestName ?? "Documento"}
                </p>
                {section === "stays" ? (
                  <StayButton stay={row as unknown as Stay} />
                ) : (
                  <>
                    <p>
                      {row.dueDate?.slice(0, 10) ??
                        (row.date ? businessDay(row.date) : "")}{" "}
                      · {row.status ?? row.type}
                      {row.reversalOfId ? " · estorno vinculado" : ""}
                    </p>
                    <p>
                      {formatCurrency(
                        section === "receipts"
                          ? (row.personValue ?? Number(row.value ?? 0))
                          : Number(row.value ?? 0),
                      )}
                      {section === "receipts" && " · aplicado a esta pessoa"}
                      {section === "titles" &&
                        ` · liquidado ${formatCurrency(Number(row.paidValue ?? 0))} · saldo ${formatCurrency(Math.max(0, Number(row.value ?? 0) - Number(row.paidValue ?? 0)))}`}
                    </p>
                    <details>
                      <summary className="cursor-pointer min-h-11">
                        Ver documento de origem
                      </summary>
                      <p className="break-all text-xs">Referência: {row.id}</p>
                      {section === "receipts" && (
                        <p>
                          Valor total do movimento:{" "}
                          {formatCurrency(Number(row.value ?? 0))}
                        </p>
                      )}
                      {row.paymentMethod && <p>Meio: {row.paymentMethod}</p>}
                      {row.installments?.map((p) => (
                        <p key={p.id}>
                          {p.dueDate.slice(0, 10)} ·{" "}
                          {formatCurrency(Number(p.value))} · liquidado{" "}
                          {formatCurrency(Number(p.paidValue))}
                        </p>
                      ))}
                      {row.sourceStayId && (
                        <p className="text-sm">
                          Hospedagem de origem: {row.sourceStayId}
                        </p>
                      )}
                      {row.sourceStay && (
                        <StayButton
                          stay={row.sourceStay}
                          label="Abrir hospedagem de origem"
                        />
                      )}
                    </details>
                  </>
                )}
              </article>
            ))
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={page <= 1 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span>
              Página {page} · {data.total} registros
            </span>
            <Button
              variant="outline"
              disabled={page * 20 >= data.total || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
