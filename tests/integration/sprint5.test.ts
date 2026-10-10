import { executeOperation } from "@/lib/server/operations";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { type Actor, hashToken, SESSION_COOKIE } from "@/lib/server/auth";
import {
  buildManagementReport,
  getManagementReport,
} from "@/lib/server/management-reports";
import { getReportSource } from "@/lib/server/report-source";
import {
  clearAllCollections,
  exportAllCollections,
  importAllCollections,
} from "@/lib/server/db/relational-data-service";
import { GET } from "@/app/api/reports/route";
if (
  new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid")
    .pathname !== "/erp_test"
)
  throw Error("S5 exige erp_test isolado");
let actor: Actor;
const token = "5".repeat(64),
  id = "s5-" + randomUUID();
const q = { start: "2026-01-01", end: "2026-01-01" };
const report = (section: string) =>
  prisma.$transaction((tx) =>
    buildManagementReport(
      tx,
      actor,
      { ...q, section },
      new Date("2026-01-03T12:00:00Z"),
    ),
  );
const value = (r: Awaited<ReturnType<typeof report>>, key: string) =>
  r.metrics.find((m) => m.key === key)!.value;
beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      id,
      username: id,
      password: "integration-only",
      role: "supervisor",
      createdBy: "test",
      fullName: "Teste S5",
      accessProfile: "administrador",
    },
  });
  const session = await prisma.authSession.create({
    data: {
      userId: id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  actor = {
    id,
    username: user.username,
    role: "supervisor",
    sessionId: session.id,
    approvedUntil: null,
    permissions: ALL_PERMISSIONS,
  };
});
beforeEach(async () => {
  await clearAllCollections();
  await prisma.room.createMany({
    data: [
      { id: 1, number: "101", type: "casal", status: "disponivel" },
      { id: 2, number: "102", type: "casal", status: "disponivel" },
    ],
  });
  await prisma.customer.create({
    data: { id: "s5-company", name: "Empresa", cpfCnpj: "11222333000181" },
  });
  await prisma.guestProfile.create({
    data: { cpf: "52998224725", name: "Pessoa" },
  });
  await prisma.reservation.create({
    data: {
      id: "s5-reservation",
      roomId: 1,
      roomNumber: "101",
      guestName: "Pessoa",
      cpf: "52998224725",
      checkIn: new Date("2026-01-01"),
      checkOut: new Date("2026-01-03"),
      status: "checkout",
      totalValue: 400,
    },
  });
  await prisma.stay.create({
    data: {
      id: "s5-stay",
      reservationId: "s5-reservation",
      payerId: "s5-company",
      guestName: "Pessoa",
      roomId: 1,
      checkIn: new Date("2026-01-01"),
      checkOut: new Date("2026-01-03"),
      status: "closed",
      endedAt: new Date("2026-01-03T12:00:00Z"),
      lodgingValue: 400,
      nightlyPrices: [
        { date: "2026-01-01", total: 300 },
        { date: "2026-01-02", total: 100 },
      ],
      allocations: {
        create: [
          {
            id: "s5-a",
            roomId: 1,
            start: new Date("2026-01-01"),
            end: new Date("2026-01-02"),
          },
          {
            id: "s5-b",
            roomId: 2,
            start: new Date("2026-01-02"),
            end: new Date("2026-01-03"),
          },
        ],
      },
      charges: {
        create: [
          {
            id: "s5-charge",
            label: "Água",
            quantity: 1,
            unitPrice: 20,
            createdAt: new Date("2026-01-01T10:00:00Z"),
            sourceSaleId: null,
          },
        ],
      },
    },
  });
  await prisma.bankAccount.create({
    data: {
      id: "s5-bank",
      name: "Conta",
      type: "corrente",
      initialBalance: 0,
      currentBalance: 50,
    },
  });
  await prisma.transaction.create({
    data: {
      id: "s5-old-receipt",
      date: new Date("2026-01-01T12:00:00Z"),
      description: "Recebimento de dívida antiga",
      value: 50,
      type: "receita",
      paymentMethod: "PIX",
      originType: "receivable-batch",
      originId: "old",
      accountId: "s5-bank",
    },
  });
});
afterAll(async () => {
  await prisma.user.delete({ where: { id } });
  await prisma.$disconnect();
});
describe("Sprint 5 — números pela origem e recuperação", () => {
  it("AP-29: 300 prestados + bebida 20; receber dívida antiga 50 não eleva prestação", async () => {
    const r = await report("resultado");
    expect(value(r, "provided")).toBe(300);
    expect(value(r, "beverages")).toBe(20);
    expect(value(r, "partialResult")).toBe(320);
    const f = await report("financeiro");
    expect(value(f, "inflow")).toBe(50);
  });
  it("ocupação usa noite/quarto, troca não duplica e saída é exclusiva", async () => {
    const r = await prisma.$transaction((tx) =>
      buildManagementReport(
        tx,
        actor,
        { ...q, end: "2026-01-03", section: "hospedagem" },
        new Date("2026-01-04T12:00:00Z"),
      ),
    );
    expect(value(r, "roomNights")).toBe(2);
    expect(value(r, "capacityNights")).toBe(6);
    expect(value(r, "lodgingProvided")).toBe(400);
    expect(r.rows.map((r) => r.details?.roomId)).toEqual([1, 2]);
  });
  it("AP-30: UTC antes de 03h cai no dia anterior; vencimento usa data civil", async () => {
    await prisma.transaction.create({
      data: {
        id: "s5-midnight",
        date: new Date("2026-01-02T02:30:00Z"),
        description: "Virada",
        value: 7,
        type: "receita",
      },
    });
    await prisma.expense.create({
      data: {
        id: "s5-bill",
        description: "Vencimento",
        category: "outros",
        value: 10,
        dueDate: new Date("2026-01-01"),
      },
    });
    const r = await report("financeiro");
    expect(value(r, "inflow")).toBe(57);
    expect(value(r, "payables")).toBe(10);
    expect(r.rows.find((r) => r.id === "pagar:s5-bill")?.date).toBe(
      "2026-01-01",
    );
  });
  it("parcelas substituem título, pagamento parcial usa saldo atual e vencido separado", async () => {
    await prisma.accountReceivable.create({
      data: {
        id: "s5-debt",
        customerId: "s5-company",
        customerName: "Empresa",
        description: "Dívida",
        value: 100,
        paidValue: 20,
        status: "pendente",
        issueDate: new Date("2025-12-01"),
        dueDate: new Date("2026-01-01"),
        sourceStayId: "s5-stay",
        installments: {
          create: [
            {
              id: "s5-part1",
              installmentNumber: 1,
              value: 40,
              paidValue: 20,
              status: "pendente",
              dueDate: new Date("2025-12-31"),
            },
            {
              id: "s5-part2",
              installmentNumber: 2,
              value: 60,
              status: "pendente",
              dueDate: new Date("2026-01-01"),
            },
          ],
        },
      },
    });
    const r = await report("financeiro");
    expect(value(r, "receivables")).toBe(60);
    expect(value(r, "priorReceivables")).toBe(20);
    expect(value(r, "companyDebt")).toBe(80);
    expect(r.rows.filter((r) => r.source.id === "s5-debt")).toHaveLength(2);
  });
  it("transferências não geram resultado nem fluxo do negócio", async () => {
    await prisma.transaction.createMany({
      data: [
        {
          id: "s5-transfer-in",
          date: new Date("2026-01-01T12:00:00Z"),
          description: "Transferência entrada",
          value: 100,
          type: "transferencia_entrada",
        },
        {
          id: "s5-transfer-out",
          date: new Date("2026-01-01T12:00:00Z"),
          description: "Transferência saída",
          value: 100,
          type: "transferencia_saida",
        },
      ],
    });
    expect(value(await report("financeiro"), "netFlow")).toBe(50);
    expect(value(await report("resultado"), "partialResult")).toBe(320);
  });
  it("consulta, exportação e origem exigem os mesmos acessos de dados", async () => {
    await expect(
      getManagementReport(
        { ...actor, permissions: ["reports.read"] },
        { ...q, section: "resultado" },
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      getManagementReport(
        {
          ...actor,
          permissions: ALL_PERMISSIONS.filter((p) => p !== "reports.export"),
        },
        { ...q, section: "hospedagem" },
        "csv",
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      getReportSource(actor, {
        section: "hospedagem",
        collection: "users",
        id: actor.id,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const d = await getReportSource(actor, {
      section: "hospedagem",
      collection: "stays",
      id: "s5-stay",
    });
    expect(d.document).toHaveProperty("lodgingValue");
  });
  it("API autentica, não cacheia exportação e registra filtros na auditoria", async () => {
    const path =
      "http://localhost:3002/api/reports?section=hospedagem&start=2026-01-01&end=2026-01-01&format=csv";
    expect((await GET(new NextRequest(path))).status).toBe(401);
    const r = await GET(
      new NextRequest(path, {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.text()).toContain("Relatório gerencial não fiscal");
    const a = await prisma.auditEntry.findFirstOrThrow({
      where: { action: "Relatório gerencial exportado" },
      orderBy: { date: "desc" },
    });
    expect(a.metadata).toMatchObject({
      start: "2026-01-01",
      end: "2026-01-01",
      format: "csv",
    });
  });

  it("compra não vira despesa de resultado; consumo e perda usam alocação real", async () => {
    await prisma.productCategory.create({
      data: { id: "s5-beverages", name: "Bebidas", icon: "Cup", color: "blue" },
    });
    await prisma.pOSProduct.create({
      data: {
        id: "s5-water",
        name: "Água",
        price: 20,
        categoryId: "s5-beverages",
        trackStock: true,
        requiresExpiry: true,
      },
    });
    await prisma.supplier.create({
      data: { id: "s5-supplier", name: "Fornecedor" },
    });
    await executeOperation(actor, randomUUID(), "purchase-receive", {
      supplierId: "s5-supplier",
      items: [
        {
          productId: "s5-water",
          packaging: "Fardo",
          factor: 12,
          acceptedPackages: 2,
          refusedPackages: 0,
          packagePrice: 60,
          code: "S5",
          expiresAt: "2030-01-01",
        },
      ],
      freight: 0,
      discount: 0,
      dueDate: "2026-01-01",
    });
    await executeOperation(actor, randomUUID(), "sale", {
      sale: {
        id: randomUUID(),
        items: [
          {
            id: randomUUID(),
            product: { id: "s5-water" },
            quantity: 1,
            discount: 0,
          },
        ],
        total: 20,
        amountPaid: 20,
        paymentMethod: "pix",
        accountId: "s5-bank",
      },
      globalDiscount: 0,
    });
    const lot = await prisma.stockLot.findFirstOrThrow({
      where: { productId: "s5-water" },
    });
    await executeOperation(actor, randomUUID(), "stock-loss", {
      lotId: lot.id,
      recordVersion: lot.recordVersion,
      quantity: 1,
      reason: "Quebra registrada",
    });
    await prisma.pOSSale.updateMany({
      data: { date: new Date("2026-01-01T12:00:00Z") },
    });
    await prisma.stockMovement.updateMany({
      data: { timestamp: new Date("2026-01-01T12:00:00Z") },
    });
    await prisma.purchase.updateMany({
      data: { receivedAt: new Date("2026-01-01T12:00:00Z") },
    });
    const i = await report("estoque");
    expect(value(i, "purchases")).toBe(120);
    expect(value(i, "consumedCost")).toBe(5);
    expect(value(i, "lossCost")).toBe(5);
    expect(value(i, "stockValue")).toBe(110);
    const r = await report("resultado");
    expect(value(r, "expenses")).toBe(0);
    expect(value(r, "partialResult")).toBe(330);
  });

  it("PDV lançado na hospedagem aparece uma única vez no relatório de bebidas", async () => {
    await prisma.pOSSale.create({
      data: {
        id: "s5-linked-sale",
        date: new Date("2026-01-01T12:00:00Z"),
        subtotal: 20,
        discount: 0,
        total: 20,
        stayId: "s5-stay",
        paymentMethod: "Conta da hospedagem",
        amountPaid: 0,
        change: 0,
        operator: "Test",
        status: "concluida",
      },
    });
    await prisma.stayCharge.update({
      where: { id: "s5-charge" },
      data: { sourceSaleId: "s5-linked-sale", lineTotal: 20 },
    });
    expect(value(await report("bebidas"), "beverageRevenue")).toBe(20);
  });
  it("AP-32: restauração portátil conserva origens e totais sem refazer operações", async () => {
    const before = await report("resultado"),
      snapshot = await exportAllCollections();
    await importAllCollections(snapshot);
    const after = await report("resultado");
    expect(after.metrics).toEqual(before.metrics);
    expect(after.rows).toEqual(before.rows);
    expect(
      await prisma.transaction.count({ where: { id: "s5-old-receipt" } }),
    ).toBe(1);
  });
});
