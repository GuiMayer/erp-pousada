import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { businessDay } from "@/lib/utils/business-values";
import { cents, money, type ManagementReport } from "@/lib/reports/management";
import type { Actor } from "./auth";
import { authorizeReport } from "./management-reports";
import { can } from "./permissions";
import { HttpError } from "./http";
import { recordAudit } from "./audit";
export const forecastQuery = z
  .object({
    days: z.coerce.number().int().min(1).max(90).default(30),
    accounts: z.string().max(4000).optional(),
    cash: z.enum(["0", "1"]).default("0"),
  })
  .strict();
export async function financialForecast(
  actor: Actor,
  input: unknown,
  format?: "csv" | "json",
  now = new Date(),
) {
  const q = forecastQuery.parse(input);
  authorizeReport(actor, "financeiro", !!format);
  return prisma.$transaction(
    async (tx) => {
      const start = businessDay(now),
        dates = Array.from({ length: q.days }, (_, i) =>
          new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10),
        ),
        end = dates.at(-1)!;
      const accounts = await tx.bankAccount.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      });
      const selected =
        q.accounts === undefined
          ? accounts.map((a) => a.id)
          : q.accounts.split(",").filter(Boolean);
      if (
        selected.length > 100 ||
        selected.some((id) => !accounts.some((a) => a.id === id))
      )
        throw new HttpError(400, "Conta inexistente ou inativa");
      const report: ManagementReport = {
        section: "financeiro",
        start,
        end,
        asOf: now.toISOString(),
        metrics: [],
        rows: [],
        criteria: [
          "Projeção prospectiva a partir de hoje: saldo interno base + títulos pendentes por vencimento. Não reconstrói previsão histórica.",
          "Parcelas substituem o título. Vencidos ficam separados e não são recebidos/pagos ficticiamente hoje.",
          "Reservas são cenário comercial separado: data estimada de cobrança na saída planejada, sem obrigação ou dinheiro confirmado.",
          "Cartões registrados no saldo interno não comprovam repasse bancário. A projeção não é saldo disponível confirmado.",
          "Contas selecionadas: " +
            accounts
              .filter((a) => selected.includes(a.id))
              .map((a) => a.name)
              .join(", "),
          "Caixa aberto incluído: " + (q.cash === "1" ? "Sim" : "Não"),
        ],
        warnings: [
          "Confira saldos internos, valores em cartão e datas de cobrança antes de assumir disponibilidade.",
        ],
      };
      let base = accounts
        .filter((a) => selected.includes(a.id))
        .reduce((s, a) => s + cents(a.currentBalance), 0);
      if (q.cash === "1") {
        const cash = await tx.cashClose.findFirst({
          where: { status: "aberto" },
        });
        if (cash) {
          const entries = await tx.transaction.findMany({
            where: { cashSessionId: cash.id, paymentMethod: "dinheiro" },
            select: { type: true, value: true },
            take: 50001,
          });
          if (entries.length > 50000)
            throw new HttpError(
              413,
              "Turno extenso; encerre e confira o caixa",
            );
          base +=
            cents(cash.openingValue) +
            entries.reduce(
              (s, t) =>
                s +
                (t.type === "receita" || t.type === "transferencia_entrada"
                  ? 1
                  : -1) *
                  cents(t.value),
              0,
            );
        } else
          report.warnings.push(
            "Não há turno aberto; nenhum fundo encerrado foi incluído.",
          );
      }
      const [receivables, payables] = await Promise.all([
        tx.accountReceivable.findMany({
          where: { status: { notIn: ["pago", "cancelado"] } },
          include: { installments: true },
          take: 50001,
        }),
        tx.expense.findMany({
          where: { paid: false },
          include: { installments: true },
          take: 50001,
        }),
      ]);
      if (receivables.length > 50000 || payables.length > 50000)
        throw new HttpError(413, "Muitos títulos para esta projeção");
      const flow = new Map<string, { incoming: number; outgoing: number }>();
      let priorIn = 0,
        priorOut = 0;
      for (const [kind, titles] of [
        ["receber", receivables],
        ["pagar", payables],
      ] as const)
        for (const title of titles) {
          const parts = title.installments.length
            ? title.installments
            : [title];
          for (const part of parts) {
            const value = Math.max(
                0,
                cents(part.value) - cents(part.paidValue),
              ),
              date = part.dueDate.toISOString().slice(0, 10);
            if (!value || date > end) continue;
            const incoming = kind === "receber";
            if (date < start) {
              if (incoming) priorIn += value;
              else priorOut += value;
            } else {
              const day = flow.get(date) ?? { incoming: 0, outgoing: 0 };
              if (incoming) day.incoming += value;
              else day.outgoing += value;
              flow.set(date, day);
            }
            report.rows.push({
              id: `${kind}:${part.id}`,
              date,
              kind: date < start ? `${kind}-vencido` : `${kind}-previsto`,
              label: title.description,
              value: money(incoming ? value : -value),
              source: {
                collection: incoming ? "accountsReceivable" : "expenses",
                id: title.id,
              },
            });
          }
        }
      let balance = base;
      for (const date of dates) {
        const f = flow.get(date) ?? { incoming: 0, outgoing: 0 };
        balance += f.incoming - f.outgoing;
        report.rows.push({
          id: `saldo:${date}`,
          date,
          kind: "saldo-projetado",
          label: "Saldo interno projetado",
          value: money(balance),
          source: { collection: "bankAccounts", id: selected[0] ?? "" },
          details: { incoming: money(f.incoming), outgoing: money(f.outgoing) },
        });
      }
      if (can(actor, "reservations.read") && can(actor, "stays.read")) {
        const reservations = await tx.reservation.findMany({
          where: { status: "confirmada" },
          select: {
            id: true,
            guestName: true,
            totalValue: true,
            paidValue: true,
            checkOut: true,
          },
          take: 50001,
        });
        if (reservations.length > 50000)
          throw new HttpError(413, "Muitas reservas");
        const origins = await tx.stay.findMany({
            where: { reservationId: { in: reservations.map((r) => r.id) } },
            select: { id: true, reservationId: true },
            take: 50001,
          }),
          represented = await tx.accountReceivable.findMany({
            where: {
              sourceStayId: { in: origins.map((s) => s.id) },
              status: { not: "cancelado" },
            },
            select: { sourceStayId: true },
            take: 50001,
          }),
          representedIds = new Set(represented.map((t) => t.sourceStayId)),
          excluded = new Set(
            origins
              .filter((s) => representedIds.has(s.id))
              .map((s) => s.reservationId),
          );
        if (origins.length > 50000 || represented.length > 50000)
          throw new HttpError(
            413,
            "Muitas origens de reserva para esta projeção",
          );
        for (const r of reservations) {
          if (excluded.has(r.id)) continue;
          const value = Math.max(0, cents(r.totalValue) - cents(r.paidValue)),
            date = r.checkOut.toISOString().slice(0, 10);
          if (value && date <= end)
            report.rows.push({
              id: `reserva:${r.id}`,
              date,
              kind: date < start ? "reserva-sem-previsao" : "reserva-cenario",
              label: `Reserva · ${r.guestName}`,
              value: money(value),
              estimated: true,
              source: { collection: "reservations", id: r.id },
              details: {
                criterion:
                  date < start
                    ? "Data planejada ultrapassada; sem previsão"
                    : "Cobrança estimada na saída; confira condição acordada",
              },
            });
        }
      } else
        report.warnings.push(
          "Cenário de reservas indisponível para seu acesso; não foi incluído.",
        );
      if (report.rows.length > 50000)
        throw new HttpError(413, "Muitos documentos; reduza o horizonte");
      report.metrics = [
        {
          key: "base",
          label: "Saldo interno base",
          value: money(base),
          unit: "money",
        },
        {
          key: "final",
          label: "Saldo interno projetado final",
          value: money(balance),
          unit: "money",
        },
        {
          key: "priorIn",
          label: "Recebíveis vencidos separados",
          value: money(priorIn),
          unit: "money",
        },
        {
          key: "priorOut",
          label: "Pagáveis vencidos separados",
          value: money(priorOut),
          unit: "money",
        },
      ];
      if (format)
        await recordAudit(
          tx,
          actor,
          "Projeção financeira exportada",
          "financeiro",
          {
            entityType: "reports",
            operation: "export",
            metadata: {
              start,
              end,
              format,
              accounts: selected,
              cash: q.cash,
              rows: report.rows.length,
            },
          },
        );
      return {
        ...report,
        accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
        selected,
        cash: q.cash,
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
}
