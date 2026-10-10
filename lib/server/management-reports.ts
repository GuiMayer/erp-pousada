import { recordAudit } from "./audit";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import type { Actor } from "./auth";
import { demand } from "./permissions";
import { HttpError } from "./http";
import { businessDay } from "@/lib/utils/business-values";
import { lotUsable } from "@/lib/inventory";
import {
  reportQuery,
  reportAccess,
  reportBounds,
  calendarDays,
  nextDay,
  spreadCents,
  cents,
  money,
  type ReportQuery,
  type ManagementReport,
  type ReportLine,
  type ReportSection,
} from "@/lib/reports/management";
type Tx = Prisma.TransactionClient;
const cap = <T>(rows: T[]) => {
  if (rows.length > 50000)
    throw new HttpError(
      413,
      "Muitos documentos; reduza o período do relatório",
    );
  return rows;
};
const calendar = (date: Date) => date.toISOString().slice(0, 10);
const inside = (day: string, q: ReportQuery) => day >= q.start && day <= q.end;
const metric = (
  key: string,
  label: string,
  value: number,
  unit: "money" | "number" | "percent" = "money",
) => ({ key, label, value, unit });
function base(q: ReportQuery, now: Date): ManagementReport {
  return {
    ...q,
    asOf: now.toISOString(),
    criteria: [],
    warnings: [],
    metrics: [],
    rows: [],
  };
}
const sum = (rows: ReportLine[], kind: string) =>
  money(
    rows
      .filter((r) => r.kind === kind)
      .reduce((s, r) => s + cents(r.value ?? 0), 0),
  );
export function authorizeReport(
  actor: Actor,
  section: ReportSection,
  exporting = false,
) {
  demand(actor, "reports.read");
  for (const permission of reportAccess[section]) demand(actor, permission);
  if (exporting) demand(actor, "reports.export");
}
async function lodging(tx: Tx, q: ReportQuery, now: Date) {
  const out = base(q, now),
    today = businessDay(now),
    occupied = new Set<string>();
  const stays = cap(
    await tx.stay.findMany({
      where: {
        checkIn: { lt: new Date(nextDay(q.end)) },
        checkOut: { gt: new Date(q.start) },
        status: { in: ["active", "closed"] },
      },
      include: { allocations: true },
      take: 50001,
    }),
  );
  const rooms = await tx.room.count();
  let agreed = 0,
    provided = 0;
  for (const stay of stays) {
    const days = calendarDays(calendar(stay.checkIn), calendar(stay.checkOut));
    const original = Array.isArray(stay.nightlyPrices)
      ? (stay.nightlyPrices as unknown as { date: string; total: number }[])
      : [];
    const valid =
      original.length === days.length &&
      original.every(
        (n) =>
          days.includes(n.date) && Number.isFinite(n.total) && n.total >= 0,
      ) &&
      new Set(original.map((n) => n.date)).size === days.length &&
      original.reduce((s, n) => s + cents(n.total), 0) ===
        cents(stay.lodgingValue);
    const nights = valid
      ? original.map((n) => ({ date: n.date, value: cents(n.total) }))
      : spreadCents(cents(stay.lodgingValue), days);
    if (!valid)
      out.warnings.push(
        `Hospedagem ${stay.id}: valor por noite estimado pelo rateio do total acordado.`,
      );
    const end = stay.endedAt
      ? [calendar(stay.checkOut), businessDay(stay.endedAt)].sort()[0]
      : calendar(stay.checkOut);
    for (const night of nights) {
      if (!inside(night.date, q)) continue;
      agreed += night.value;
      const allocation = stay.allocations.find(
        (a) => calendar(a.start) <= night.date && calendar(a.end) > night.date,
      );
      const providedNight = night.date < today && night.date < end;
      out.rows.push({
        id: `${stay.id}:${night.date}`,
        date: night.date,
        kind: providedNight ? "diaria-prestada" : "diaria-acordada",
        label: stay.guestName,
        value: money(night.value),
        quantity: 1,
        estimated: !valid,
        source: { collection: "stays", id: stay.id },
        details: {
          roomId: allocation?.roomId ?? stay.roomId,
          payerId: stay.payerId ?? "",
          reservationId: stay.reservationId,
        },
      });
      if (providedNight) {
        provided += night.value;
        const key = `${allocation?.roomId ?? stay.roomId}:${night.date}`;
        if (occupied.has(key))
          out.warnings.push(`Ocupação duplicada no quarto/noite ${key}.`);
        occupied.add(key);
      }
    }
  }
  const missing = await tx.reservation.count({
    where: {
      status: { in: ["checkin", "checkout"] },
      checkIn: { lt: new Date(nextDay(q.end)) },
      checkOut: { gt: new Date(q.start) },
      id: { notIn: stays.map((s) => s.reservationId) },
    },
  });
  if (missing)
    out.warnings.push(
      `${missing} reservas atendidas sem hospedagem estruturada; valores não incluídos.`,
    );
  const elapsed = calendarDays(q.start, nextDay(q.end)).filter(
      (d) => d < today,
    ).length,
    capacity = rooms * elapsed;
  out.metrics = [
    metric("lodgingAgreed", "Diárias acordadas no período", money(agreed)),
    metric("lodgingProvided", "Diárias prestadas", money(provided)),
    metric("roomNights", "Noites-quarto ocupadas", occupied.size, "number"),
    metric("capacityNights", "Noites-quarto do catálogo", capacity, "number"),
    metric(
      "occupancy",
      "Ocupação do catálogo",
      capacity ? Math.round((occupied.size / capacity) * 10000) / 100 : 0,
      "percent",
    ),
    metric(
      "adr",
      "Diária média por noite-quarto prestada",
      occupied.size ? money(Math.round(provided / occupied.size)) : 0,
    ),
  ];
  out.criteria = [
    "Entrada inclusiva, saída exclusiva. Noite prestada somente após a virada do dia em America/Sao_Paulo; saída efetiva limita as noites prestadas.",
    "Ocupação usa quartos do catálogo atual × dias encerrados do período; bloqueios históricos não têm série completa e não são deduzidos.",
    "Reservas futuras, sinais e recebimentos de dívidas não elevam diárias prestadas. Valores acordados não são receitas recebidas.",
    "Uma transferência de quarto conserva a diária e usa a alocação da noite. Rateio legado reconcilia centavos e é identificado como estimativa.",
  ];
  return out;
}
async function beverages(tx: Tx, q: ReportQuery, now: Date) {
  const out = base(q, now),
    bounds = reportBounds(q);
  const sales = cap(
    await tx.pOSSale.findMany({
      where: { date: bounds, stayId: null },
      include: {
        items: { include: { product: { include: { category: true } } } },
      },
      take: 50001,
    }),
  );
  for (const sale of sales) {
    if (sale.items.some((i) => i.product.category.isRestaurant)) {
      out.warnings.push(
        `Venda ${sale.id} contém restaurante arquivado e foi excluída.`,
      );
      continue;
    }
    out.rows.push({
      id: sale.id,
      date: businessDay(sale.date),
      kind: sale.status === "concluida" ? "bebida-pdv" : "venda-cancelada",
      label: sale.customer ?? "Venda avulsa",
      value: sale.status === "concluida" ? Number(sale.total) : 0,
      quantity:
        sale.status === "concluida"
          ? sale.items.reduce((s, i) => s + i.quantity, 0)
          : 0,
      source: { collection: "posSales", id: sale.id },
      details: { status: sale.status, paymentMethod: sale.paymentMethod },
    });
  }
  const charges = cap(
    await tx.stayCharge.findMany({
      where: { createdAt: bounds },
      include: { stay: { select: { id: true, guestName: true } } },
      take: 50001,
    }),
  );
  for (const charge of charges)
    out.rows.push({
      id: charge.id,
      date: businessDay(charge.createdAt),
      kind:
        charge.status === "active" ? "bebida-hospedagem" : "consumo-removido",
      label: charge.label,
      value:
        charge.status === "active"
          ? money(
              charge.lineTotal === null
                ? cents(charge.unitPrice) * charge.quantity
                : cents(charge.lineTotal),
            )
          : 0,
      quantity: charge.status === "active" ? charge.quantity : 0,
      source: { collection: "stays", id: charge.stayId },
      details: {
        chargeId: charge.id,
        sourceSaleId: charge.sourceSaleId ?? "",
        guestName: charge.stay.guestName,
      },
    });
  if (charges.some((c) => !c.productId))
    out.warnings.push(
      "Há consumos legados sem produto: não é possível confirmar se todos são bebidas ou rastrear seu custo.",
    );
  out.metrics = [
    metric(
      "beverageRevenue",
      "Bebidas vendidas/lançadas",
      sum(out.rows, "bebida-pdv") + sum(out.rows, "bebida-hospedagem"),
    ),
    metric("posRevenue", "Vendas avulsas", sum(out.rows, "bebida-pdv")),
    metric(
      "stayBeverages",
      "Consumos na hospedagem",
      sum(out.rows, "bebida-hospedagem"),
    ),
  ];
  out.criteria = [
    "Vendas avulsas pelo total líquido registrado; consumos por data de lançamento. Status vigente na geração; cancelamentos posteriores revisam o período original.",
    "Venda lançada em hospedagem aparece somente na linha do extrato, evitando somar PDV e consumo novamente.",
    "Bebida vendida/lançada não é recebimento: pagamento de conta antiga pertence ao fluxo financeiro.",
  ];
  return out;
}
async function inventory(tx: Tx, q: ReportQuery, now: Date) {
  const out = base(q, now),
    bounds = reportBounds(q),
    today = businessDay(now);
  const lots = cap(
    await tx.stockLot.findMany({
      where: { product: { category: { isRestaurant: false } } },
      include: { product: true },
      take: 50001,
    }),
  );
  let stockValue = 0,
    usableValue = 0;
  const stockTotals = new Map<
    string,
    { physical: number; usable: number; value: number }
  >();
  for (const lot of lots) {
    if (lot.quantity.isZero()) continue;
    const valid = lotUsable(
      { status: lot.status, expiresAt: lot.expiresAt?.toISOString() ?? null },
      today,
      lot.product.requiresExpiry,
    );
    const total = stockTotals.get(lot.productId) ?? {
      physical: 0,
      usable: 0,
      value: 0,
    };
    total.physical += Number(lot.quantity);
    total.value += cents(lot.remainingValue);
    if (valid) total.usable += Number(lot.quantity);
    stockTotals.set(lot.productId, total);
    stockValue += cents(lot.remainingValue);
    if (valid) {
      usableValue += cents(lot.remainingValue);
    }
    out.rows.push({
      id: lot.id,
      date: today,
      kind: "saldo-lote",
      label: `${lot.product.name} · ${lot.code}`,
      value: Number(lot.remainingValue),
      quantity: Number(lot.quantity),
      estimated: lot.costEstimated,
      source: { collection: "stockLots", id: lot.id },
      details: {
        unit: lot.product.unit,
        usableQuantity: valid ? Number(lot.quantity) : 0,
        status: lot.status,
        expiresAt: lot.expiresAt ? calendar(lot.expiresAt) : "Sem validade",
      },
    });
  }

  const stocks = cap(
    await tx.stockItem.findMany({
      where: { product: { category: { isRestaurant: false } } },
      take: 50001,
    }),
  );
  let lowProducts = 0;
  for (const stock of stocks) {
    const totals = stockTotals.get(stock.productId) ?? {
      physical: 0,
      usable: 0,
      value: 0,
    };
    const physical = Math.round(totals.physical * 1000) / 1000,
      available = Math.round(totals.usable * 1000) / 1000,
      value = totals.value;
    if (available <= Number(stock.minimumStock)) lowProducts++;
    if (Math.abs(physical - Number(stock.currentStock)) > 0.0005)
      out.warnings.push(
        `Bebida ${stock.productName}: saldo agregado diverge dos lotes; confira antes de operar.`,
      );
    out.rows.push({
      id: stock.id,
      date: today,
      kind: "resumo-produto",
      label: stock.productName,
      value: money(value),
      quantity: physical,
      source: { collection: "stockItems", id: stock.id },
      details: {
        unit: stock.unit,
        usableQuantity: available,
        minimumStock: Number(stock.minimumStock),
        maximumStock: Number(stock.maximumStock),
        status:
          available <= Number(stock.minimumStock)
            ? "Atingiu mínimo"
            : "Acima do mínimo",
      },
    });
  }
  const purchases = cap(
    await tx.purchase.findMany({ where: { receivedAt: bounds }, take: 50001 }),
  );
  for (const purchase of purchases)
    out.rows.push({
      id: purchase.id,
      date: businessDay(purchase.receivedAt),
      kind: "compra",
      label: purchase.supplierName,
      value: Number(purchase.total),
      source: { collection: "purchases", id: purchase.id },
    });
  const movements = cap(
    await tx.stockMovement.findMany({
      where: {
        timestamp: bounds,
        product: { category: { isRestaurant: false } },
      },
      include: {
        allocations: { include: { lot: { select: { costEstimated: true } } } },
      },
      take: 50001,
    }),
  );
  for (const movement of movements) {
    const type = movement.originType;
    const kind =
      type === "consumption"
        ? "custo-consumido"
        : type === "customer-return"
          ? "custo-restituido"
          : type === "loss"
            ? "perda"
            : type === "inventory"
              ? "ajuste-inventario"
              : type === "supplier-return"
                ? "devolucao-fornecedor"
                : null;
    if (!kind) {
      if (!type && ["saida", "perda"].includes(movement.type)) {
        out.rows.push({
          id: movement.id,
          date: businessDay(movement.timestamp),
          kind: "custo-legado",
          label: movement.reason,
          value:
            movement.cost === null
              ? null
              : money(
                  Math.round(Number(movement.quantity) * cents(movement.cost)),
                ),
          quantity: Number(movement.quantity),
          estimated: true,
          source: { collection: "stockMovements", id: movement.id },
        });
        out.warnings.push(
          `Movimento ${movement.id}: custo/origem legados fora do resultado por falta de rastreabilidade.`,
        );
      }
      continue;
    }
    const allocated = movement.allocations.reduce(
        (s, a) => s + cents(a.value),
        0,
      ),
      signed = -allocated;
    const estimated =
      !movement.allocations.length ||
      movement.allocations.some((a) => a.lot.costEstimated);
    out.rows.push({
      id: movement.id,
      date: businessDay(movement.timestamp),
      kind,
      label: movement.reason,
      value: movement.allocations.length ? money(signed) : null,
      quantity: Number(movement.quantity),
      estimated,
      source: { collection: "stockMovements", id: movement.id },
      details: {
        unit: movement.unit,
        originType: type ?? "",
        originId: movement.originId ?? "",
      },
    });
  }
  if (out.rows.some((r) => r.estimated || r.value === null))
    out.warnings.push(
      "Há custos estimados ou ausentes. Resultado parcial não deve ser interpretado como lucro contábil.",
    );
  if (out.rows.some((r) => r.kind === "ajuste-inventario"))
    out.warnings.push(
      "Diferenças de inventário estão separadas; investigue sua causa antes de classificá-las no resultado.",
    );
  out.metrics = [
    metric("stockValue", "Valor físico atual", money(stockValue)),
    metric("usableValue", "Valor utilizável atual", money(usableValue)),
    metric(
      "unavailableLots",
      "Lotes indisponíveis",
      out.rows.filter(
        (r) =>
          r.kind === "saldo-lote" && Number(r.details?.usableQuantity) === 0,
      ).length,
      "number",
    ),
    metric("lowProducts", "Bebidas no mínimo ou abaixo", lowProducts, "number"),
    metric("purchases", "Compras recebidas", sum(out.rows, "compra")),
    metric(
      "consumedCost",
      "Custo consumido líquido de restituições físicas",
      sum(out.rows, "custo-consumido") + sum(out.rows, "custo-restituido"),
    ),
    metric("lossCost", "Perdas registradas", sum(out.rows, "perda")),
    metric(
      "inventoryDifference",
      "Custo de diferenças de inventário",
      sum(out.rows, "ajuste-inventario"),
    ),
  ];
  out.criteria = [
    "Compras e movimentos respeitam o período; saldo por lote é a posição atual na geração, não uma posição histórica.",
    "Custo por alocação real de lote FEFO em centavos. Custo de abertura estimado e ausência de alocação são sinalizados.",
    "Compras aumentam estoque e dívida; somente consumo/perda baixa o custo no resultado. Devolução ao fornecedor não é custo consumido.",
    "Quantidades de unidades distintas não são somadas no resumo; consulte a unidade em cada origem.",
  ];
  return out;
}
async function expenses(tx: Tx, q: ReportQuery, now: Date) {
  const out = base(q, now);
  const documents = cap(
    await tx.expense.findMany({
      where: {
        dueDate: { gte: new Date(q.start), lt: new Date(nextDay(q.end)) },
        sourcePurchaseId: null,
      },
      take: 50001,
    }),
  );
  for (const d of documents)
    out.rows.push({
      id: d.id,
      date: calendar(d.dueDate),
      kind: "despesa-gerencial",
      label: d.description,
      value: Number(d.value),
      estimated: true,
      source: { collection: "expenses", id: d.id },
      details: { category: d.category, paidValue: Number(d.paidValue) },
    });
  out.warnings.push(
    "Despesas sem origem de compra usam vencimento como aproximação de competência; revisar mercadoria antiga sem vínculo. Depreciação, tributos e outras obrigações não registradas não são inferidos.",
  );
  return out;
}
async function finance(tx: Tx, q: ReportQuery, now: Date) {
  const out = base(q, now),
    today = businessDay(now);
  const transactions = cap(
    await tx.transaction.findMany({
      where: { date: reportBounds(q) },
      include: { allocations: true },
      take: 50001,
    }),
  );
  for (const t of transactions) {
    const flow =
      t.type === "receita"
        ? 1
        : ["despesa", "estorno"].includes(t.type)
          ? -1
          : 0;
    out.rows.push({
      id: t.id,
      date: businessDay(t.date),
      kind:
        flow > 0
          ? "entrada-realizada"
          : flow < 0
            ? "saida-realizada"
            : "movimento-sem-fluxo",
      label: t.description,
      value: flow ? Number(t.value) * flow : 0,
      source: { collection: "transactions", id: t.id },
      details: {
        type: t.type,
        originType: t.originType ?? "Legado/manual",
        originId: t.originId ?? "",
        accountId: t.accountId ?? "Caixa/sem conta",
        paymentMethod: t.paymentMethod ?? "Sem meio",
        reversalOfId: t.reversalOfId ?? "",
        allocated: Number(
          t.allocations.reduce((s, a) => s + Number(a.value), 0),
        ),
      },
    });
  }
  const debts = cap(
    await tx.accountReceivable.findMany({
      where: { status: { notIn: ["pago", "cancelado", "cancelada"] } },
      include: { installments: true },
      take: 50001,
    }),
  );
  const bills = cap(
    await tx.expense.findMany({
      where: { paid: false },
      include: { installments: true },
      take: 50001,
    }),
  );
  let companyDebt = 0;
  for (const debt of debts) {
    if (debt.sourceStayId)
      companyDebt += Math.max(0, cents(debt.value) - cents(debt.paidValue));
    const targets = debt.installments.length ? debt.installments : [debt];
    for (const t of targets) {
      const balance = Math.max(0, cents(t.value) - cents(t.paidValue));
      if (!balance) continue;
      const due = calendar(t.dueDate);
      if (!inside(due, q) && due >= q.start) continue;
      out.rows.push({
        id: `receber:${t.id}`,
        date: due,
        kind: due < q.start ? "receber-anterior" : "receber-previsto",
        label: debt.customerName,
        value: money(balance),
        source: { collection: "accountsReceivable", id: debt.id },
        details: {
          installmentId: t.id === debt.id ? "" : t.id,
          overdue: due < today ? "Sim" : "Não",
          sourceStayId: debt.sourceStayId ?? "",
          position: "Saldo atual",
        },
      });
    }
  }
  for (const bill of bills) {
    const targets = bill.installments.length ? bill.installments : [bill];
    for (const t of targets) {
      const balance = Math.max(0, cents(t.value) - cents(t.paidValue));
      if (!balance) continue;
      const due = calendar(t.dueDate);
      if (!inside(due, q) && due >= q.start) continue;
      out.rows.push({
        id: `pagar:${t.id}`,
        date: due,
        kind: due < q.start ? "pagar-anterior" : "pagar-previsto",
        label: bill.description,
        value: -money(balance),
        source: { collection: "expenses", id: bill.id },
        details: {
          installmentId: t.id === bill.id ? "" : t.id,
          overdue: due < today ? "Sim" : "Não",
          sourcePurchaseId: bill.sourcePurchaseId ?? "",
          position: "Saldo atual",
        },
      });
    }
  }
  const accounts = await tx.bankAccount.findMany();
  for (const a of accounts)
    out.rows.push({
      id: a.id,
      date: today,
      kind: "saldo-conta",
      label: a.name,
      value: Number(a.currentBalance),
      source: { collection: "bankAccounts", id: a.id },
      details: {
        active: a.active ? "Sim" : "Não",
        position: "Saldo interno atual; não conciliado",
      },
    });
  const sessions = cap(
    await tx.cashClose.findMany({
      where: { OR: [{ date: reportBounds(q) }, { status: "aberto" }] },
      take: 50001,
    }),
  );
  const cashEntries = cap(
    await tx.transaction.findMany({
      where: { cashSessionId: { in: sessions.map((s) => s.id) } },
      take: 50001,
    }),
  );
  const bySession = new Map<string, typeof cashEntries>();
  for (const entry of cashEntries) {
    const list = bySession.get(entry.cashSessionId!) ?? [];
    list.push(entry);
    bySession.set(entry.cashSessionId!, list);
  }
  for (const s of sessions) {
    const entries = bySession.get(s.id) ?? [];
    const expected = entries.reduce(
      (v, t) =>
        v +
        (["receita", "transferencia_entrada"].includes(t.type)
          ? cents(t.value)
          : -cents(t.value)),
      cents(s.openingValue),
    );
    out.rows.push({
      id: s.id,
      date: businessDay(s.closedAt ?? s.openedAt ?? s.date),
      kind: "turno-caixa",
      label: s.operator,
      value: money(expected),
      source: { collection: "cashCloses", id: s.id },
      details: {
        status: s.status,
        openingValue: Number(s.openingValue),
        counted: Number(s.physicalValue),
        divergence:
          s.status === "fechado" ? Number(s.divergence) : "Ainda aberto",
      },
    });
  }
  out.metrics = [
    metric(
      "inflow",
      "Entradas financeiras realizadas",
      sum(out.rows, "entrada-realizada"),
    ),
    metric(
      "outflow",
      "Saídas financeiras realizadas",
      -sum(out.rows, "saida-realizada"),
    ),
    metric(
      "netFlow",
      "Fluxo realizado líquido",
      sum(out.rows, "entrada-realizada") + sum(out.rows, "saida-realizada"),
    ),
    metric(
      "receivables",
      "A receber por vencimento",
      sum(out.rows, "receber-previsto"),
    ),
    metric(
      "payables",
      "A pagar por vencimento",
      -sum(out.rows, "pagar-previsto"),
    ),
    metric(
      "priorReceivables",
      "A receber anterior ao período",
      sum(out.rows, "receber-anterior"),
    ),
    metric(
      "priorPayables",
      "A pagar anterior ao período",
      -sum(out.rows, "pagar-anterior"),
    ),
    metric(
      "forecastNet",
      "Previsão líquida dos saldos no período",
      sum(out.rows, "receber-previsto") + sum(out.rows, "pagar-previsto"),
    ),
    metric(
      "companyDebt",
      "Dívida atual de hospedagem empresarial",
      money(companyDebt),
    ),
  ];
  out.criteria = [
    "Realizado pela data do lançamento em America/Sao_Paulo; transferências internas, sangria/suprimento e créditos sem dinheiro não geram entradas/saídas do negócio.",
    "Previsto usa saldo atual de títulos/parcelas e vencimento; títulos com parcelas entram uma vez por parcela. Saldos anteriores ao início aparecem separados.",
    "Recebimento de dívida antiga e reembolso de fornecedor são entradas financeiras, não venda/prestação do período.",
    "Contas e caixa mostram posição interna atual. Cartões não têm taxa/repasse/compensação bancária modelados.",
  ];
  out.warnings = [
    "Saldo de conta não é saldo bancário conciliado; entradas em cartão não comprovam repasse.",
    "Previsão é saldo pendente atual, não o valor originalmente previsto nem uma comparação histórica de previsão x realizado.",
  ];
  return out;
}
export async function buildManagementReport(
  tx: Tx,
  actor: Actor,
  input: unknown,
  now = new Date(),
): Promise<ManagementReport> {
  const q = reportQuery.parse(input);
  authorizeReport(actor, q.section);
  let out: ManagementReport;
  if (q.section === "hospedagem") out = await lodging(tx, q, now);
  else if (q.section === "bebidas") out = await beverages(tx, q, now);
  else if (q.section === "estoque") out = await inventory(tx, q, now);
  else if (q.section === "financeiro") out = await finance(tx, q, now);
  else {
    const l = await lodging(tx, q, now),
      b = await beverages(tx, q, now),
      i = await inventory(tx, q, now),
      e = await expenses(tx, q, now);
    out = base(q, now);
    out.rows = [
      ...l.rows.filter((r) => r.kind === "diaria-prestada"),
      ...b.rows,
      ...i.rows.filter((r) =>
        [
          "custo-consumido",
          "custo-restituido",
          "perda",
          "ajuste-inventario",
          "custo-legado",
        ].includes(r.kind),
      ),
      ...e.rows,
    ];
    out.warnings = [...l.warnings, ...b.warnings, ...i.warnings, ...e.warnings];
    const provided = sum(out.rows, "diaria-prestada"),
      sold = sum(out.rows, "bebida-pdv") + sum(out.rows, "bebida-hospedagem"),
      consumed =
        sum(out.rows, "custo-consumido") + sum(out.rows, "custo-restituido"),
      loss = sum(out.rows, "perda"),
      expense = sum(out.rows, "despesa-gerencial");
    out.metrics = [
      metric("provided", "Hospedagem prestada", provided),
      metric("beverages", "Bebidas vendidas/lançadas", sold),
      metric("consumedCost", "Custo consumido conhecido", consumed),
      metric("lossCost", "Perdas conhecidas", loss),
      metric("expenses", "Despesas por vencimento (aproximação)", expense),
      metric(
        "partialResult",
        "Resultado gerencial parcial/estimado",
        money(
          cents(provided) +
            cents(sold) -
            cents(consumed) -
            cents(loss) -
            cents(expense),
        ),
      ),
    ];
    out.criteria = [
      ...l.criteria,
      ...b.criteria,
      ...i.criteria,
      "Resultado parcial = prestação + bebidas − consumo líquido de restituições físicas − perdas − despesas sem origem de compra pelo vencimento. Recebimentos, compras, transferências e diferenças de inventário não classificadas não são somados ao resultado.",
      "Resultado gerencial não fiscal; não é apuração contábil de lucro. Dados e custos ausentes permanecem identificados.",
    ];
  }
  out.rows.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  out.warnings = [...new Set(out.warnings)];
  return out;
}
export async function getManagementReport(
  actor: Actor,
  input: unknown,
  exportFormat?: string,
) {
  const q = reportQuery.parse(input);
  authorizeReport(actor, q.section, !!exportFormat);
  return prisma.$transaction(
    async (tx) => {
      const report = await buildManagementReport(tx, actor, q);
      if (exportFormat)
        await recordAudit(
          tx,
          actor,
          "Relatório gerencial exportado",
          q.section,
          {
            entityType: "reports",
            operation: "export",
            metadata: {
              section: q.section,
              start: q.start,
              end: q.end,
              format: exportFormat,
              rows: report.rows.length,
            },
          },
        );
      return report;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30000,
    },
  );
}
