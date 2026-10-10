import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { executeOperation } from "@/lib/server/operations";
import { ALL_PERMISSIONS, PROFILES } from "@/lib/permissions";
import type { Actor } from "@/lib/server/auth";
import { businessDay } from "@/lib/utils/business-values";
import {
  getCollection,
  createCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
  exportAllCollections,
  importAllCollections,
} from "@/lib/server/db/relational-data-service";
import { evaluateTimed, evaluateStock } from "@/lib/server/notifications/rules";
if (
  new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid")
    .pathname !== "/erp_test"
)
  throw new Error("S4 exige erp_test isolado");
let actor: Actor, stockActor: Actor;
const prefix = "s4-" + randomUUID(),
  today = businessDay(),
  day = (offset: number) =>
    new Date(Date.parse(today) + offset * 86400000).toISOString().slice(0, 10);
beforeAll(async () => {
  for (const profile of ["administrador", "estoque"]) {
    const user = await prisma.user.create({
        data: {
          id: prefix + profile,
          username: prefix + profile,
          password: "test-only",
          fullName: "Teste S4",
          role: "supervisor",
          accessProfile: profile,
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
    const a: Actor = {
      id: user.id,
      username: user.username,
      role: "supervisor",
      sessionId: session.id,
      approvedUntil: null,
      permissions:
        profile === "administrador"
          ? ALL_PERMISSIONS
          : PROFILES.estoque.permissions,
    };
    if (profile === "administrador") actor = a;
    else stockActor = a;
  }
});
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    "TRUNCATE customers, rooms, product_categories, transactions, stock_inventories, notification_events CASCADE",
  );
  for (const a of [actor, stockActor])
    await prisma.authSession.upsert({
      where: { id: a.sessionId },
      create: {
        id: a.sessionId,
        userId: a.id,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 3600000),
      },
      update: { expiresAt: new Date(Date.now() + 3600000) },
    });
  await prisma.supplier.create({
    data: { id: "s4-supplier", name: "Fornecedor S4" },
  });
  await prisma.productCategory.create({
    data: { id: "s4-category", name: "Bebidas", icon: "Cup", color: "blue" },
  });
  await prisma.pOSProduct.create({
    data: {
      id: "s4-water",
      name: "Água S4",
      categoryId: "s4-category",
      price: 8,
      trackStock: true,
      requiresExpiry: true,
    },
  });
  await prisma.bankAccount.upsert({
    where: { id: "s4-bank" },
    create: {
      id: "s4-bank",
      name: "Banco S4",
      type: "corrente",
      initialBalance: 1000,
      currentBalance: 1000,
    },
    update: { currentBalance: 1000 },
  });
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
});
const op = (kind: string, payload: unknown, a = actor, key = randomUUID()) =>
  executeOperation(a, key, kind, payload);
const item = (overrides: Record<string, unknown> = {}) => ({
  productId: "s4-water",
  packaging: "Fardo",
  factor: 12,
  acceptedPackages: 2,
  refusedPackages: 0,
  packagePrice: 60,
  code: "LOTE-S4",
  expiresAt: day(30),
  ...overrides,
});
const receipt = (overrides: Record<string, unknown> = {}) => ({
  supplierId: "s4-supplier",
  items: [item()],
  freight: 0,
  discount: 0,
  dueDate: day(30),
  ...overrides,
});
const sale = (quantity: number) => ({
  sale: {
    id: randomUUID(),
    items: [
      { id: randomUUID(), product: { id: "s4-water" }, quantity, discount: 0 },
    ],
    total: quantity * 8,
    amountPaid: quantity * 8,
    paymentMethod: "pix",
    accountId: "s4-bank",
  },
  globalDiscount: 0,
});
const lot = () =>
  prisma.stockLot.findFirstOrThrow({ where: { productId: "s4-water" } });
const physical = async () =>
  Number(
    (
      await prisma.stockItem.findUniqueOrThrow({
        where: { productId: "s4-water" },
      })
    ).currentStock,
  );
describe("S4 — recebimentos, lotes e contagem por corte", () => {
  it("AP17/27: dois fardos geram 24 unidades, custo 5 e uma única obrigação mesmo no reenvio", async () => {
    const key = randomUUID(),
      input = receipt();
    await op("purchase-receive", input, actor, key);
    await op("purchase-receive", input, actor, key);
    expect(await physical()).toBe(24);
    expect(Number((await lot()).unitCost)).toBe(5);
    expect(await prisma.purchase.count()).toBe(1);
    expect(await prisma.expense.count()).toBe(1);
    expect(await prisma.stockMovement.count()).toBe(1);
    expect(Number((await prisma.expense.findFirstOrThrow()).value)).toBe(120);
  });
  it("AP18: rateio conserva centavos e o preço de venda", async () => {
    await op(
      "purchase-receive",
      receipt({
        items: [
          item({ acceptedPackages: 1, packagePrice: 0.01 }),
          item({ acceptedPackages: 1, packagePrice: 0.01, code: "OUTRO" }),
        ],
        freight: 0.01,
        discount: 0,
      }),
    );
    const rows = await prisma.purchaseItem.findMany();
    expect(
      rows.reduce((s, r) => s + Math.round(Number(r.totalCost) * 100), 0),
    ).toBe(3);
    expect(
      Number(
        (
          await prisma.pOSProduct.findUniqueOrThrow({
            where: { id: "s4-water" },
          })
        ).price,
      ),
    ).toBe(8);
    expect(
      Number(
        (await prisma.stockLot.aggregate({ _sum: { remainingValue: true } }))
          ._sum.remainingValue,
      ),
    ).toBe(0.03);
  });
  it("AP19: recusadas não entram no saldo ou na dívida", async () => {
    await op(
      "purchase-receive",
      receipt({ items: [item({ acceptedPackages: 1, refusedPackages: 1 })] }),
    );
    expect(await physical()).toBe(12);
    expect(Number((await prisma.expense.findFirstOrThrow()).value)).toBe(60);
    expect((await prisma.purchaseItem.findFirstOrThrow()).refusedPackages).toBe(
      1,
    );
  });
  it("documento de fornecedor repetido não duplica entrada", async () => {
    await op("purchase-receive", receipt({ reference: "REC-001" }));
    await expect(
      op("purchase-receive", receipt({ reference: "REC-001" })),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(await physical()).toBe(24);
  });
  it("falha no pagamento à vista desfaz mercadoria, documento e obrigação", async () => {
    await expect(
      op(
        "purchase-receive",
        receipt({ payNow: true, paymentMethod: "pix", accountId: "missing" }),
      ),
    ).rejects.toThrow();
    expect(await prisma.purchase.count()).toBe(0);
    expect(await prisma.stockLot.count()).toBe(0);
    expect(await prisma.expense.count()).toBe(0);
  });
  it("à vista paga pela mesma obrigação, sem despesa adicional", async () => {
    await op(
      "purchase-receive",
      receipt({ payNow: true, paymentMethod: "pix", accountId: "s4-bank" }),
    );
    const expense = await prisma.expense.findFirstOrThrow();
    expect(expense.paid).toBe(true);
    expect(Number(expense.paidValue)).toBe(120);
    expect(await prisma.transaction.count({ where: { type: "despesa" } })).toBe(
      1,
    );
    expect(
      Number(
        (
          await prisma.bankAccount.findUniqueOrThrow({
            where: { id: "s4-bank" },
          })
        ).currentBalance,
      ),
    ).toBe(880);
  });
  it("parcelas reconciliam o total e preservam vencimentos", async () => {
    await op(
      "purchase-receive",
      receipt({
        installments: [
          { value: 60, dueDate: day(10) },
          { value: 60, dueDate: day(30) },
        ],
      }),
    );
    expect(await prisma.expenseInstallment.count()).toBe(2);
    await expect(
      op(
        "purchase-receive",
        receipt({ installments: [{ value: 10, dueDate: day(10) }] }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("AP20: FEFO usa lote mais próximo válido e bloqueia vencidos", async () => {
    await op(
      "purchase-receive",
      receipt({
        items: [
          item({
            factor: 1,
            acceptedPackages: 2,
            packagePrice: 5,
            code: "LATER",
            expiresAt: day(10),
          }),
          item({
            factor: 1,
            acceptedPackages: 2,
            packagePrice: 5,
            code: "FIRST",
            expiresAt: day(2),
          }),
        ],
      }),
    );
    await op("sale", sale(1));
    const first = await prisma.stockLot.findFirstOrThrow({
      where: { code: "FIRST" },
    });
    expect(Number(first.quantity)).toBe(1);
    await prisma.stockLot.updateMany({
      data: { expiresAt: new Date(day(-1)) },
    });
    await expect(op("sale", sale(1))).rejects.toMatchObject({ status: 409 });
    expect(await physical()).toBe(3);
    const projected = (await getCollection("stockItems")) as {
      usableStock: number;
    }[];
    expect(projected[0].usableStock).toBe(0);
  });
  it("validade ausente/vencida, fator inválido e embalagem fracionária são recusados", async () => {
    for (const row of [
      item({ expiresAt: undefined }),
      item({ expiresAt: day(-1) }),
      item({ factor: 0 }),
      item({ acceptedPackages: 1.5 }),
    ])
      await expect(
        op("purchase-receive", receipt({ items: [row] })),
      ).rejects.toThrow();
    expect(await prisma.purchase.count()).toBe(0);
  });
  it("AP21: último item concorrente só atende uma venda", async () => {
    await op(
      "purchase-receive",
      receipt({
        items: [item({ factor: 1, acceptedPackages: 1, packagePrice: 5 })],
      }),
    );
    const results = await Promise.allSettled([
      op("sale", sale(1)),
      op("sale", sale(1)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await physical()).toBe(0);
    expect(Number((await lot()).remainingValue)).toBe(0);
  });
  it("AP22: corte 20, contagem 18 e saída posterior 3 resultam em 15", async () => {
    await op(
      "purchase-receive",
      receipt({
        items: [item({ factor: 1, acceptedPackages: 20, packagePrice: 5 })],
      }),
    );
    const inv = (await op("inventory-start", {
      reason: "Contagem semanal",
    })) as { id: string };
    await op("sale", sale(3));
    const current = await prisma.stockInventory.findUniqueOrThrow({
      where: { id: inv.id },
    });
    await op("inventory-post", {
      inventoryId: inv.id,
      recordVersion: current.recordVersion,
      counts: [{ lotId: (await lot()).id, quantity: 18 }],
    });
    expect(await physical()).toBe(15);
    const line = await prisma.stockInventoryLine.findFirstOrThrow();
    expect(Number(line.delta)).toBe(-2);
    expect(Number((await lot()).remainingValue)).toBe(75);
  });
  it("inventário preserva novos lotes e recusa delta que ficaria negativo", async () => {
    await op(
      "purchase-receive",
      receipt({
        items: [item({ factor: 1, acceptedPackages: 2, packagePrice: 5 })],
      }),
    );
    const original = await lot(),
      inv = (await op("inventory-start", {
        reason: "Contagem de abertura",
      })) as { id: string };
    await op("sale", sale(2));
    await op(
      "purchase-receive",
      receipt({
        items: [
          item({
            factor: 1,
            acceptedPackages: 1,
            packagePrice: 5,
            code: "NOVO",
          }),
        ],
      }),
    );
    const current = await prisma.stockInventory.findUniqueOrThrow({
      where: { id: inv.id },
    });
    await expect(
      op("inventory-post", {
        inventoryId: inv.id,
        recordVersion: current.recordVersion,
        counts: [{ lotId: original.id, quantity: 0 }],
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await physical()).toBe(1);
    expect(
      (await prisma.stockInventory.findUniqueOrThrow({ where: { id: inv.id } }))
        .status,
    ).toBe("open");
  });
  it("AP19: devolução física preserva a dívida; abatimento depende do acordo", async () => {
    await op("purchase-receive", receipt());
    const l = await lot(),
      returned = (await op("purchase-return", {
        lotId: l.id,
        recordVersion: l.recordVersion,
        quantity: 2,
        reason: "Unidades danificadas",
      })) as { id: string };
    expect(await physical()).toBe(22);
    expect(Number((await prisma.expense.findFirstOrThrow()).value)).toBe(120);
    const r = await prisma.purchaseReturn.findUniqueOrThrow({
      where: { id: returned.id },
    });
    await op("return-settle", {
      returnId: r.id,
      recordVersion: r.recordVersion,
      resolution: "discount",
      value: 10,
      reason: "Abatimento combinado",
    });
    expect(Number((await prisma.expense.findFirstOrThrow()).value)).toBe(110);
    expect(await prisma.transaction.count()).toBe(0);
  });
  it("reembolso exige pagamento anterior e credita a conta uma única vez", async () => {
    await op(
      "purchase-receive",
      receipt({ payNow: true, paymentMethod: "pix", accountId: "s4-bank" }),
    );
    const l = await lot(),
      returned = (await op("purchase-return", {
        lotId: l.id,
        recordVersion: l.recordVersion,
        quantity: 2,
        reason: "Devolução combinada",
      })) as { id: string },
      r = await prisma.purchaseReturn.findUniqueOrThrow({
        where: { id: returned.id },
      }),
      key = randomUUID(),
      input = {
        returnId: r.id,
        recordVersion: r.recordVersion,
        resolution: "refund",
        value: 10,
        reason: "Fornecedor devolveu via PIX",
        paymentMethod: "pix",
        accountId: "s4-bank",
      };
    await op("return-settle", input, actor, key);
    await op("return-settle", input, actor, key);
    expect(await physical()).toBe(22);
    expect(
      Number(
        (
          await prisma.bankAccount.findUniqueOrThrow({
            where: { id: "s4-bank" },
          })
        ).currentBalance,
      ),
    ).toBe(890);
    expect(
      await prisma.transaction.count({
        where: { originType: "purchase-return" },
      }),
    ).toBe(1);
  });
  it("AP23: estorno financeiro não repõe; retorno físico restaura lote/custo original", async () => {
    await op("purchase-receive", receipt());
    const input = sale(2);
    await op("sale", input);
    await op("cancel-sale", {
      saleId: input.sale.id,
      reason: "Garrafas intactas devolvidas",
      returnToStock: true,
    });
    expect(await physical()).toBe(24);
    expect(Number((await lot()).remainingValue)).toBe(120);
    const second = sale(1);
    await op("sale", second);
    await op("cancel-sale", {
      saleId: second.sale.id,
      reason: "Acerto sem retorno físico",
      returnToStock: false,
    });
    expect(await physical()).toBe(23);
  });
  it("saldo legado importado fica físico, pendente e indisponível até revisão explícita", async () => {
    await prisma.stockItem.create({
      data: {
        id: "old-stock",
        productId: "s4-water",
        productName: "Água",
        unit: "un",
        currentStock: 5,
        minimumStock: 0,
        maximumStock: 0,
        averageCost: 3,
        lastPurchasePrice: 3,
      },
    });
    const snapshot = JSON.parse(await exportAllCollections());
    for (const k of [
      "purchases",
      "stockLots",
      "stockInventories",
      "purchaseReturns",
    ])
      delete snapshot[k];
    await importAllCollections(JSON.stringify(snapshot));
    const l = await lot();
    expect(l.status).toBe("unverified");
    expect(l.expiresAt).toBeNull();
    await expect(op("sale", sale(1))).rejects.toMatchObject({ status: 409 });
    await op("lot-review", {
      lotId: l.id,
      recordVersion: l.recordVersion,
      code: "REAL",
      expiresAt: day(30),
      status: "active",
      reason: "Conferido no rótulo",
    });
    await op("sale", sale(1));
    expect(await physical()).toBe(4);
  });
  it("backup portátil restaura vínculos, custo e corte sem replay de movimentos", async () => {
    await op("purchase-receive", receipt());
    await op("sale", sale(2));
    await op("inventory-start", { reason: "Contagem de teste" });
    const snapshot = await exportAllCollections();
    await importAllCollections(snapshot);
    expect(await physical()).toBe(22);
    expect(Number((await lot()).remainingValue)).toBe(110);
    expect((await prisma.expense.findFirstOrThrow()).sourcePurchaseId).toBe(
      (await prisma.purchase.findFirstOrThrow()).id,
    );
    expect(await prisma.stockMovementLot.count()).toBe(2);
    expect(await prisma.stockInventoryLine.count()).toBe(1);
  });
  it("permissões separam recebimento, pagamento, abertura e confirmação de inventário", async () => {
    await op("purchase-receive", receipt(), stockActor);
    await expect(
      op(
        "stock-opening",
        {
          productId: "s4-water",
          quantity: 1,
          totalCost: 5,
          code: "EXTRA",
          expiresAt: day(10),
          reason: "Abertura física",
        },
        stockActor,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      op(
        "purchase-receive",
        receipt({ payNow: true, paymentMethod: "pix", accountId: "s4-bank" }),
        stockActor,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(await prisma.purchase.count()).toBe(1);
    await expect(
      createCollectionItem("stockLots", { id: "forged" }, actor),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("API antiga não permite sobrescrever saldo ou apagar obrigação da compra", async () => {
    await op("purchase-receive", receipt());
    const stock = await prisma.stockItem.findFirstOrThrow(),
      expense = await prisma.expense.findFirstOrThrow();
    await expect(
      op("stock-movement", {
        productId: "s4-water",
        type: "ajuste",
        quantity: 999,
        reason: "Adulteração",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateCollectionItem(
        "stockItems",
        stock.id,
        { currentStock: 999, recordVersion: stock.recordVersion },
        actor,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      deleteCollectionItem(
        "expenses",
        expense.id,
        prisma,
        actor,
        expense.recordVersion,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateCollectionItem(
        "expenses",
        expense.id,
        { value: 999, recordVersion: expense.recordVersion },
        actor,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("alertas usam saldo utilizável e vencimento resolve após perda autorizada", async () => {
    await op("purchase-receive", receipt());
    await prisma.stockLot.updateMany({
      data: { expiresAt: new Date(day(-1)) },
    });
    await prisma.stockItem.updateMany({
      where: { productId: "s4-water" },
      data: { minimumStock: 2 },
    });
    await prisma.$transaction(evaluateTimed);
    await prisma.$transaction(evaluateStock);
    expect(
      await prisma.notificationEvent.count({
        where: {
          conditionKey: { startsWith: "expiry:" },
          priority: "critical",
        },
      }),
    ).toBe(1);
    expect(
      await prisma.notificationEvent.count({
        where: { conditionKey: "stock:s4-water", priority: "critical" },
      }),
    ).toBe(1);
    const l = await lot();
    await op("stock-loss", {
      lotId: l.id,
      recordVersion: l.recordVersion,
      quantity: 24,
      reason: "Descarte por vencimento",
    });
    expect(await physical()).toBe(0);
    expect(
      await prisma.notificationEvent.count({
        where: { conditionKey: { startsWith: "expiry:" } },
      }),
    ).toBe(0);
  });
  it('estorno físico agrupa linhas da mesma bebida e não duplica restituição',async()=>{
    await op('purchase-receive',receipt());const input=sale(2),first=input.sale.items[0];input.sale.items=[{...first,quantity:1},{...first,id:randomUUID(),quantity:1}]
    await op('sale',input);await op('cancel-sale',{saleId:input.sale.id,reason:'Duas unidades devolvidas intactas',returnToStock:true});expect(await physical()).toBe(24);expect(Number((await lot()).remainingValue)).toBe(120)
  })
  it('cadastro não desativa rastreabilidade de bebida com lote',async()=>{
    await op('purchase-receive',receipt());const product=await prisma.pOSProduct.findUniqueOrThrow({where:{id:'s4-water'}})
    await expect(updateCollectionItem('posProducts',product.id,{trackStock:false,recordVersion:product.recordVersion},actor)).rejects.toMatchObject({status:409})
  })

  it("produção arquivada não contorna os lotes da pousada", async () => {
    await op("purchase-receive", receipt());
    const recipeId = randomUUID();
    await prisma.recipe.create({ data: { id: recipeId, name: "Receita indevida", category: "teste", version: 1, expectedYield: 1, yieldUnit: "un", preparationTime: 1, instructions: "Teste", ingredients: { create: [{ id: randomUUID(), productId: "s4-water", productName: "Água", quantity: 1, unit: "un", cost: 5 }] } } });
    await expect(op("production", { recipeId, plannedQuantity: 1, producedQuantity: 1 })).rejects.toMatchObject({ status: 409 });
    expect(await physical()).toBe(24);
    expect(Number((await lot()).remainingValue)).toBe(120);
    expect(await prisma.production.count({ where: { recipeId } })).toBe(0);
  });

});
