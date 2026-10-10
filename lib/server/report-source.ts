import { z } from "zod";
import { prisma } from "@/lib/db/client";
import type { Actor } from "./auth";
import { demand } from "./permissions";
import { HttpError } from "./http";
import { authorizeReport } from "./management-reports";
import { reportSections, type ReportSection } from "@/lib/reports/management";
const allowed: Record<ReportSection, string[]> = {
  hospedagem: ["stays"],
  bebidas: ["stays", "posSales"],
  estoque: ["stockLots", "stockMovements", "purchases", "stockItems"],
  financeiro: [
    "transactions",
    "expenses",
    "accountsReceivable",
    "bankAccounts",
    "cashCloses",
  ],
  resultado: ["stays", "posSales", "stockMovements", "expenses"],
};
const schema = z
  .object({
    section: z.enum(reportSections),
    collection: z.string().min(1).max(40),
    id: z.string().min(1).max(200),
  })
  .strict();
export async function getReportSource(actor: Actor, input: unknown) {
  const q = schema.parse(input);
  authorizeReport(actor, q.section);
  if (!allowed[q.section].includes(q.collection))
    throw new HttpError(403, "Origem não permitida neste relatório");
  demand(actor, `${q.collection}.read`);
  const where = { id: q.id };
  let document: unknown;
  switch (q.collection) {
    case "stays":
      document = await prisma.stay.findUnique({
        where,
        include: {
          allocations: true,
          charges: true,
          payments: true,
          adjustments: true,
        },
      });
      break;
    case "posSales":
      document = await prisma.pOSSale.findUnique({
        where,
        include: { items: true },
      });
      break;
    case "stockItems":
      document = await prisma.stockItem.findUnique({ where });
      break;
    case "stockLots":
      document = await prisma.stockLot.findUnique({
        where,
        include: { product: { select: { id: true, name: true, unit: true } } },
      });
      break;
    case "stockMovements":
      document = await prisma.stockMovement.findUnique({
        where,
        include: { allocations: true },
      });
      break;
    case "purchases":
      document = await prisma.purchase.findUnique({
        where,
        include: { items: true },
      });
      break;
    case "transactions":
      document = await prisma.transaction.findUnique({
        where,
        include: { allocations: true },
      });
      break;
    case "expenses":
      document = await prisma.expense.findUnique({
        where,
        include: { installments: true },
      });
      break;
    case "accountsReceivable":
      document = await prisma.accountReceivable.findUnique({
        where,
        include: { installments: true },
      });
      break;
    case "bankAccounts":
      document = await prisma.bankAccount.findUnique({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          currentBalance: true,
          initialBalance: true,
          active: true,
        },
      });
      break;
    case "cashCloses":
      document = await prisma.cashClose.findUnique({ where });
      break;
  }
  if (!document) throw new HttpError(404, "Documento de origem não encontrado");
  return { collection: q.collection, document };
}
