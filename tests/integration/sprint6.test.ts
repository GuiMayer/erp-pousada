import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import type { Actor } from "@/lib/server/auth";
import { personDossier } from "@/lib/server/person-dossier";
import { financialForecast } from "@/lib/server/financial-forecast";
import {
  previewInitialImport,
  confirmInitialImport,
} from "@/lib/server/initial-import";
import { importTemplate } from "@/lib/initial-import";
import { executeOperation } from "@/lib/server/operations";
import { businessDay } from "@/lib/utils/business-values";
import { evaluateTimed } from "@/lib/server/notifications/rules";
import { listInbox } from "@/lib/server/notifications/inbox";
import { NextRequest } from "next/server";
import { GET as getPerson } from "@/app/api/people/route";
import { GET as getForecast } from "@/app/api/forecast/route";
import { POST as postImport } from "@/app/api/initial-import/route";
import {
  exportAllCollections,
  importAllCollections,
} from "@/lib/server/db/relational-data-service";
if (
  new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid")
    .pathname !== "/erp_test"
)
  throw Error("S6 exige erp_test isolado");
const prefix = "s6-" + randomUUID(),
  today = businessDay(),
  day = (n: number) =>
    new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10);
let actor: Actor;
beforeAll(async () => {
  const user = await prisma.user.create({
      data: {
        id: prefix,
        username: prefix,
        password: "test-only",
        fullName: "S6",
        role: "supervisor",
        accessProfile: "administrador",
        createdBy: "test",
      },
    }),
    session = await prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
  actor = {
    id: user.id,
    username: user.username,
    role: "supervisor",
    sessionId: session.id,
    permissions: ALL_PERMISSIONS,
    approvedUntil: null,
  };
});
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    "TRUNCATE customers, rooms, product_categories, transactions, bank_accounts, cash_closes, stock_inventories, notification_events, initial_import_batches, operation_receipts CASCADE",
  );
  await prisma.user.update({
    where: { id: actor.id },
    data: { permissionOverrides: {} },
  });
  await prisma.authSession.upsert({
    where: { id: actor.sessionId },
    create: {
      id: actor.sessionId,
      userId: actor.id,
      tokenHash: randomUUID(),
      expiresAt: new Date(Date.now() + 3600000),
    },
    update: { expiresAt: new Date(Date.now() + 3600000) },
  });
  await prisma.customer.create({
    data: {
      id: "s6-person",
      name: "Ana",
      cpfCnpj: "52998224725",
      roles: ["payer", "guest"],
    },
  });
  await prisma.guestProfile.create({
    data: {
      customerId: "s6-person",
      cpf: "52998224725",
      name: "Ana",
      creditValue: 25,
    },
  });
  await prisma.productCategory.create({
    data: {
      id: "s6-category",
      name: "Bebidas",
      color: "#000000",
      icon: "cup",
      isRestaurant: false,
    },
  });
  await prisma.pOSProduct.create({
    data: {
      id: "s6-water",
      name: "Água",
      barcode: "S6-WATER",
      categoryId: "s6-category",
      unit: "un",
      price: 20,
      trackStock: true,
      requiresExpiry: true,
    },
  });
  await prisma.bankAccount.create({
    data: {
      id: "s6-bank",
      name: "Conta",
      type: "corrente",
      initialBalance: 1000,
      currentBalance: 1000,
    },
  });
});
afterAll(async () => {
  await prisma.authSession.deleteMany({ where: { userId: prefix } });
  await prisma.user.delete({ where: { id: prefix } });
});
const operate = (kind: string, payload: unknown, requestId = randomUUID()) =>
  executeOperation(actor, requestId, kind, payload);
const opening = (
  code: string,
  quantity: number,
  totalCost: number,
  days: number,
) =>
  operate("stock-opening", {
    productId: "s6-water",
    quantity,
    totalCost,
    code,
    expiresAt: day(days),
    reason: "Abertura para testes S6",
  });
describe("S6: fechamento dos requisitos", () => {
  it("novas APIs recusam sessão ausente e importação de outra origem", async () => {
    expect(
      (
        await getPerson(
          new NextRequest("http://localhost:3000/api/people?id=s6-person"),
        )
      ).status,
    ).toBe(401);
    expect(
      (await getForecast(new NextRequest("http://localhost:3000/api/forecast")))
        .status,
    ).toBe(401);
    expect(
      (
        await postImport(
          new NextRequest("http://localhost:3000/api/initial-import", {
            method: "POST",
            headers: { origin: "https://outra-origem.invalid" },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("ficha totaliza saldo parcial e não oferece financeiro ao cadastral", async () => {
    await prisma.accountReceivable.create({
      data: {
        id: "s6-title",
        customerId: "s6-person",
        customerName: "Ana",
        description: "Título",
        value: 600,
        paidValue: 250,
        status: "pendente",
        issueDate: new Date(today),
        dueDate: new Date(day(1)),
      },
    });
    const data = await personDossier(actor, {
      id: "s6-person",
      section: "titles",
    });
    expect(data.summary).toEqual({ titles: 1, pending: 350, settled: 250 });
    expect(data.credit).toBe(25);
    const restricted = await personDossier(
      { ...actor, permissions: ["customers.read"] },
      { id: "s6-person", section: "titles" },
    );
    expect(restricted.summary).toBeNull();
    expect(restricted.credit).toBeNull();
    expect(restricted.rows).toEqual([]);
    await expect(
      personDossier({ ...actor, permissions: [] }, { id: "s6-person" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("recebimento parcial da parcela mantém origem consultável", async () => {
    await prisma.accountReceivable.create({
      data: {
        id: "s6-title",
        customerId: "s6-person",
        customerName: "Ana",
        description: "Parcelado",
        value: 600,
        paidValue: 0,
        status: "pendente",
        issueDate: new Date(today),
        dueDate: new Date(day(1)),
        installments: {
          create: {
            id: "s6-part",
            installmentNumber: 1,
            value: 600,
            paidValue: 0,
            dueDate: new Date(day(1)),
            status: "pendente",
          },
        },
      },
    });
    await operate("receive-batch", {
      targets: [
        {
          accountReceivableId: "s6-title",
          installmentId: "s6-part",
          value: 250,
          recordVersion: (
            await prisma.accountReceivable.findUniqueOrThrow({
              where: { id: "s6-title" },
            })
          ).recordVersion,
        },
      ],
      paymentMethod: "pix",
      accountId: "s6-bank",
    });
    const data = await personDossier(actor, {
      id: "s6-person",
      section: "receipts",
    });
    expect(data.summary?.pending).toBe(350);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({ personValue: 250 });
  });
  it("projeção acumula saldo e separa vencidos, sem somar parcelas ao título", async () => {
    await prisma.accountReceivable.create({
      data: {
        id: "s6-title",
        customerId: "s6-person",
        customerName: "Ana",
        description: "Receber",
        value: 200,
        status: "pendente",
        issueDate: new Date(today),
        dueDate: new Date(today),
      },
    });
    await prisma.expense.create({
      data: {
        id: "s6-expense",
        description: "Pagar",
        category: "Serviço",
        value: 400,
        dueDate: new Date(today),
        installments: {
          create: [
            {
              id: "s6-p1",
              installmentNumber: 1,
              value: 300,
              dueDate: new Date(today),
            },
            {
              id: "s6-p2",
              installmentNumber: 2,
              value: 100,
              dueDate: new Date(day(1)),
            },
          ],
        },
      },
    });
    await prisma.accountReceivable.create({
      data: {
        id: "s6-old",
        customerId: "s6-person",
        customerName: "Ana",
        description: "Vencido",
        value: 50,
        status: "vencido",
        issueDate: new Date(day(-2)),
        dueDate: new Date(day(-1)),
      },
    });
    const result = await financialForecast(actor, {
      days: 2,
      accounts: "s6-bank",
    });
    expect(
      result.rows
        .filter((r) => r.kind === "saldo-projetado")
        .map((r) => r.value),
    ).toEqual([900, 800]);
    expect(result.metrics.find((m) => m.key === "priorIn")?.value).toBe(50);
    expect(
      Number(
        (
          await prisma.bankAccount.findUniqueOrThrow({
            where: { id: "s6-bank" },
          })
        ).currentBalance,
      ),
    ).toBe(1000);
    await expect(
      financialForecast(
        { ...actor, permissions: ["reports.read"] },
        { days: 2 },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("custo por lote mantém histórico e média do saldo, sem alterar preço", async () => {
    await opening("A", 10, 50, 3);
    await opening("B", 10, 100, 4);
    await operate("sale", {
      sale: {
        id: randomUUID(),
        items: [
          {
            id: randomUUID(),
            product: { id: "s6-water" },
            quantity: 10,
            discount: 0,
          },
        ],
        total: 200,
        amountPaid: 200,
        paymentMethod: "pix",
        accountId: "s6-bank",
      },
      globalDiscount: 0,
    });
    expect(
      Number(
        (
          await prisma.stockItem.findUniqueOrThrow({
            where: { productId: "s6-water" },
          })
        ).averageCost,
      ),
    ).toBe(10);
    expect(
      Number(
        (await prisma.stockLot.findFirstOrThrow({ where: { code: "A" } }))
          .remainingValue,
      ),
    ).toBe(0);
    expect(
      Number(
        (
          await prisma.pOSProduct.findUniqueOrThrow({
            where: { id: "s6-water" },
          })
        ).price,
      ),
    ).toBe(20);
  });
  it("reservas ficam separadas, título substitui o cenário e caixa é opcional", async () => {
    await prisma.room.create({
      data: {
        id: 61,
        number: "61",
        type: "casal",
        capacity: 2,
        status: "disponivel",
      },
    });
    for (const id of ["s6-commercial", "s6-represented"])
      await prisma.reservation.create({
        data: {
          id,
          roomId: 61,
          roomNumber: "61",
          guestName: "Ana",
          cpf: "52998224725",
          payerId: "s6-person",
          checkIn: new Date(today),
          checkOut: new Date(day(1)),
          status: "confirmada",
          totalValue: 600,
          paidValue: 100,
        },
      });
    await prisma.stay.create({
      data: {
        id: "s6-stay",
        reservationId: "s6-represented",
        roomId: 61,
        guestName: "Ana",
        payerId: "s6-person",
        checkIn: new Date(today),
        checkOut: new Date(day(1)),
        lodgingValue: 600,
        status: "closed",
      },
    });
    await prisma.accountReceivable.create({
      data: {
        id: "s6-title",
        sourceStayId: "s6-stay",
        customerId: "s6-person",
        customerName: "Ana",
        description: "Hospedagem",
        value: 500,
        status: "pendente",
        issueDate: new Date(today),
        dueDate: new Date(day(1)),
      },
    });
    await operate("cash-open", { openingValue: 30 });
    const withoutCash = await financialForecast(actor, {
      days: 2,
      accounts: "s6-bank",
    });
    expect(withoutCash.metrics.find((m) => m.key === "final")?.value).toBe(
      1500,
    );
    expect(
      withoutCash.rows
        .filter((r) => r.kind === "reserva-cenario")
        .map((r) => r.source.id),
    ).toEqual(["s6-commercial"]);
    const withCash = await financialForecast(
      actor,
      { days: 2, accounts: "s6-bank", cash: "1" },
      "json",
    );
    expect(withCash.metrics.find((m) => m.key === "base")?.value).toBe(1030);
    expect(
      await prisma.auditEntry.count({
        where: { action: "Projeção financeira exportada" },
      }),
    ).toBeGreaterThan(0);
    const ficha = await personDossier(actor, {
      id: "s6-person",
      section: "titles",
    });
    expect(ficha.rows[0]).toMatchObject({ sourceStay: { id: "s6-stay" } });
    const restricted = await personDossier(
      { ...actor, permissions: ["customers.read", "accountsReceivable.read"] },
      { id: "s6-person", section: "titles" },
    );
    expect(restricted.rows[0]).not.toHaveProperty("sourceStay");
  });
  it("alerta identifica o lote para navegação sem baixa ou resolução implícita", async () => {
    const result = (await opening("VENCE", 10, 50, 1)) as { id: string };
    await prisma.$transaction((tx) => evaluateTimed(tx));
    const inbox = await listInbox(actor),
      alert = inbox.notifications.find((n) => n.reference === result.id);
    expect(alert?.destination).toEqual({
      module: "estoque",
      section: "lots",
      id: result.id,
    });
    expect(
      Number(
        (await prisma.stockLot.findUniqueOrThrow({ where: { id: result.id } }))
          .quantity,
      ),
    ).toBe(10);
  });
  it("recebimento compartilhado mantém valor pessoal distinto do movimento", async () => {
    await prisma.customer.create({
      data: {
        id: "s6-other",
        name: "Outra pessoa",
        cpfCnpj: "11144477735",
        roles: ["payer"],
      },
    });
    for (const [id, customerId, value] of [
      ["s6-one", "s6-person", 250],
      ["s6-two", "s6-other", 100],
    ] as const)
      await prisma.accountReceivable.create({
        data: {
          id,
          customerId,
          customerName: "Exemplo",
          description: "Título",
          value,
          issueDate: new Date(today),
          dueDate: new Date(today),
          status: "pendente",
        },
      });
    const titles = await prisma.accountReceivable.findMany();
    await operate("receive-batch", {
      targets: titles.map((t) => ({
        accountReceivableId: t.id,
        recordVersion: t.recordVersion,
        value: Number(t.value),
      })),
      paymentMethod: "pix",
      accountId: "s6-bank",
    });
    const data = await personDossier(actor, {
      id: "s6-person",
      section: "receipts",
    });
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({ personValue: 250 });
    expect(Number((data.rows[0] as { value: unknown }).value)).toBe(350);
  });
  it("compra compara custo por unidade e sugere revisão sem mudar preço", async () => {
    await prisma.supplier.create({
      data: { id: "s6-supplier", name: "Fornecedor" },
    });
    const receive = (price: number, code: string) =>
      operate("purchase-receive", {
        supplierId: "s6-supplier",
        freight: 0,
        discount: 0,
        dueDate: day(10),
        items: [
          {
            productId: "s6-water",
            packaging: "Fardo",
            factor: 12,
            acceptedPackages: 1,
            refusedPackages: 0,
            packagePrice: price,
            code,
            expiresAt: day(20),
          },
        ],
      });
    await receive(60, "COMPRA-A");
    const result = await receive(72, "COMPRA-B");
    expect(result).toMatchObject({
      priceChanges: [
        { productId: "s6-water", previous: 5, current: 6, unit: "un" },
      ],
    });
    expect(
      Number(
        (
          await prisma.pOSProduct.findUniqueOrThrow({
            where: { id: "s6-water" },
          })
        ).price,
      ),
    ).toBe(20);
  });
  it("importa empresa antes da pessoa mesmo fora de ordem e não duplica", async () => {
    const csv =
      importTemplate("people") +
      "José;11144477735;hospede;;;11222333000181\nEmpresa;11222333000181;pagador|fornecedor;;;\n";
    const preview = await previewInitialImport(actor, { kind: "people", csv });
    expect(preview.rows.every((r) => r.state === "new")).toBe(true);
    expect(await prisma.customer.count()).toBe(1);
    const result = await confirmInitialImport(actor, {
      id: preview.id,
      confirmed: true,
    });
    expect(result).toMatchObject({ created: 2 });
    const person = await prisma.customer.findFirstOrThrow({
        where: { cpfCnpj: "11144477735" },
      }),
      company = await prisma.customer.findFirstOrThrow({
        where: { cpfCnpj: "11222333000181" },
      });
    expect(person.companyId).toBe(company.id);
    expect(
      await confirmInitialImport(actor, { id: preview.id, confirmed: true }),
    ).toEqual(result);
    expect(
      (await previewInitialImport(actor, { kind: "people", csv })).state,
    ).toBe("confirmed");
    expect(await prisma.customer.count()).toBe(3);
  });
  it("rejeita duplicados/invalidade na prévia e não confirma conjunto incompleto", async () => {
    const preview = await previewInitialImport(actor, {
      kind: "people",
      csv:
        importTemplate("people") +
        "José;11144477735;hospede;;;\nJosé;11144477735;hospede;;;\n",
    });
    expect(preview.rows.every((r) => r.state === "invalid")).toBe(true);
    await expect(
      confirmInitialImport(actor, { id: preview.id, confirmed: true }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await prisma.customer.count()).toBe(1);
  });
  it("abertura importada fica rastreada/estimada e repetição não soma saldo", async () => {
    const csv =
        importTemplate("opening") +
        `Água;S6-WATER;10;IMPORT;${day(10)};50;sim;Contagem de implantação\n`,
      preview = await previewInitialImport(actor, { kind: "opening", csv });
    expect(preview.rows[0].state).toBe("new");
    await confirmInitialImport(actor, { id: preview.id, confirmed: true });
    await confirmInitialImport(actor, { id: preview.id, confirmed: true });
    const lot = await prisma.stockLot.findFirstOrThrow({
      where: { code: "IMPORT" },
    });
    expect(Number(lot.quantity)).toBe(10);
    expect(lot.costEstimated).toBe(true);
    expect(lot.reason).toContain(preview.id);
    const changed = await previewInitialImport(actor, {
      kind: "opening",
      csv: csv.replace(
        "Contagem de implantação",
        "Outra contagem de implantação",
      ),
    });
    expect(changed.rows[0].state).toBe("invalid");
  });
  it("importa produto sem estoque e não concede restauração/usuários", async () => {
    const preview = await previewInitialImport(actor, {
      kind: "products",
      csv: importTemplate("products") + "Serviço;Bebidas;un;10;;nao;nao\n",
    });
    await confirmInitialImport(actor, { id: preview.id, confirmed: true });
    expect(
      (await prisma.pOSProduct.findFirstOrThrow({ where: { name: "Serviço" } }))
        .trackStock,
    ).toBe(false);
    await expect(
      previewInitialImport(
        { ...actor, permissions: ["customers.create", "customers.read"] },
        {
          kind: "people",
          csv: importTemplate("people") + "José;11144477735;hospede;;;\n",
        },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("aliases do mesmo produto não permitem duas aberturas do mesmo lote", async () => {
    const preview = await previewInitialImport(actor, {
      kind: "opening",
      csv:
        importTemplate("opening") +
        `Água;;10;MESMO;${day(10)};50;sim;Contagem inicial\n;S6-WATER;10;MESMO;${day(10)};50;sim;Contagem inicial\n`,
    });
    expect(preview.rows.every((r) => r.state === "invalid")).toBe(true);
    await expect(
      confirmInitialImport(actor, { id: preview.id, confirmed: true }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await prisma.stockLot.count()).toBe(0);
  });
  it("conflito surgido depois da prévia cancela o conjunto inteiro", async () => {
    const preview = await previewInitialImport(actor, {
      kind: "products",
      csv:
        importTemplate("products") +
        "Suco;Bebidas;un;10;SUCO;nao;nao\nCafé;Bebidas;un;5;CAFE;nao;nao\n",
    });
    await prisma.pOSProduct.create({
      data: {
        id: "s6-conflict",
        name: "Suco",
        categoryId: "s6-category",
        unit: "un",
        price: 12,
        barcode: "SUCO",
        trackStock: false,
      },
    });
    await expect(
      confirmInitialImport(actor, { id: preview.id, confirmed: true }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await prisma.pOSProduct.count({ where: { name: "Café" } })).toBe(0);
    expect(
      Number(
        (
          await prisma.pOSProduct.findUniqueOrThrow({
            where: { id: "s6-conflict" },
          })
        ).price,
      ),
    ).toBe(12);
  });
  it("prévia expirada ou permissão revogada impede confirmação", async () => {
    const preview = await previewInitialImport(actor, {
      kind: "people",
      csv: importTemplate("people") + "José;11144477735;hospede;;;\n",
    });
    await prisma.initialImportBatch.update({
      where: { id: preview.id },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      confirmInitialImport(actor, { id: preview.id, confirmed: true }),
    ).rejects.toMatchObject({ status: 409 });
    await prisma.user.update({
      where: { id: actor.id },
      data: { permissionOverrides: { "data.import": "deny" } },
    });
    await expect(
      confirmInitialImport(actor, { id: preview.id, confirmed: true }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("restauração portátil invalida recibos da antiga importação", async () => {
    const preview = await previewInitialImport(actor, {
      kind: "products",
      csv: importTemplate("products") + "Serviço;Bebidas;un;10;;nao;nao\n",
    });
    await confirmInitialImport(actor, { id: preview.id, confirmed: true });
    const snapshot = await exportAllCollections();
    await importAllCollections(snapshot, actor);
    expect(await prisma.initialImportBatch.count()).toBe(0);
    expect(await prisma.pOSProduct.count({ where: { name: "Serviço" } })).toBe(
      1,
    );
  });
  it("nova revisão invalida identidade de confirmação da prévia anterior", async () => {
    const input = {
      kind: "products",
      csv: importTemplate("products") + "Serviço;Bebidas;un;10;;nao;nao\n",
    };
    const old = await previewInitialImport(actor, input);
    const current = await previewInitialImport(actor, input);
    expect(current.id).not.toBe(old.id);
    await expect(
      confirmInitialImport(actor, { id: old.id, confirmed: true }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await prisma.pOSProduct.count({ where: { name: "Serviço" } })).toBe(
      0,
    );
    await confirmInitialImport(actor, { id: current.id, confirmed: true });
    expect(await prisma.pOSProduct.count({ where: { name: "Serviço" } })).toBe(
      1,
    );
  });
  it("mudança de unidade após prévia exige nova revisão do saldo", async () => {
    const preview = await previewInitialImport(actor, {
      kind: "opening",
      csv:
        importTemplate("opening") +
        `Água;S6-WATER;10;REVISAR;${day(10)};50;sim;Contagem inicial\n`,
    });
    await prisma.pOSProduct.update({
      where: { id: "s6-water" },
      data: { unit: "ml" },
    });
    await expect(
      confirmInitialImport(actor, { id: preview.id, confirmed: true }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await prisma.stockLot.count()).toBe(0);
  });
});
