import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Actor } from "./auth";
import { demand } from "./permissions";
import { HttpError } from "./http";
import { requireVersion } from "./concurrency";
import { recordAudit } from "./audit";
import { paymentFields, postPayments } from "./business-finance";
import { payExpense } from "./settlements";
import { businessDay } from "@/lib/utils/business-values";
import { receiptTotals } from "@/lib/inventory";
import {
  stockProduct,
  projectStock,
  lotMovement,
  quarantineUnmappedStock,
} from "./inventory-stock";
type Tx = Prisma.TransactionClient;
const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
const id = z.string().trim().min(1).max(200),
  reason = z.string().trim().min(5).max(1000);
const money = z
  .number()
  .finite()
  .nonnegative()
  .max(999999999)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001);
const qty = z
  .number()
  .finite()
  .nonnegative()
  .max(999999)
  .refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 0.00001);
const version = z.number().int().nonnegative();
const expiry = { code: id, expiresAt: z.string().date().optional() };
const line = z
  .object({
    productId: id,
    packaging: id,
    factor: qty.refine((n) => n > 0),
    acceptedPackages: z.number().int().min(0).max(100000),
    refusedPackages: z.number().int().min(0).max(100000),
    packagePrice: money,
    ...expiry,
  })
  .strict();
function checkExpiry(product: { requiresExpiry: boolean }, date?: string) {
  if (product.requiresExpiry && !date)
    throw new HttpError(
      400,
      "Informe a validade real do lote; a bebida exige controle de validade",
    );
  if (date && date < businessDay())
    throw new HttpError(
      409,
      "Recebimento ou abertura de lote vencido não permitido",
    );
}
async function audit(
  tx: Tx,
  actor: Actor,
  kind: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  await recordAudit(tx, actor, kind, entityId, {
    entityType: "inventory",
    entityId,
    operation: "action",
    metadata,
  });
}
export async function inventoryOperation(
  tx: Tx,
  actor: Actor,
  kind: string,
  payload: unknown,
): Promise<unknown | undefined> {
  if (kind === "purchase-receive") {
    const input = z
      .object({
        supplierId: id,
        reference: id.optional(),
        notes: z.string().max(2000).optional(),
        items: z.array(line).min(1).max(100),
        freight: money,
        discount: money,
        dueDate: z.string().date(),
        installments: z
          .array(
            z.object({
              value: money.refine((n) => n > 0),
              dueDate: z.string().date(),
            }),
          )
          .min(1)
          .max(24)
          .optional(),
        payNow: z.boolean().default(false),
        ...paymentFields,
      })
      .strict()
      .parse(payload);
    const supplier = await tx.supplier.findUniqueOrThrow({
      where: { id: input.supplierId },
    });
    if (!supplier.active) throw new HttpError(409, "Fornecedor inativo");
    let totals: ReturnType<typeof receiptTotals>;
    try {
      totals = receiptTotals(input.items, input.freight, input.discount);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    if (
      input.installments &&
      (input.payNow ||
        Math.round(
          input.installments.reduce((s, p) => s + Math.round(p.value * 100), 0),
        ) !== Math.round(totals.total * 100))
    )
      throw new HttpError(
        400,
        "Parcelas devem somar o total; pagamento à vista não usa parcelas",
      );
    if (input.payNow && totals.total === 0)
      throw new HttpError(400, "Compra gratuita não gera pagamento");
    const products = [];
    for (const item of input.items) {
      const product = await stockProduct(tx, item.productId);
      if (!product.active) throw new HttpError(409, "Bebida inativa");
      if (item.acceptedPackages) checkExpiry(product, item.expiresAt);
      products.push(product);
    }
    await quarantineUnmappedStock(tx);
    const purchaseId = randomUUID();
    await tx.purchase.create({
      data: {
        id: purchaseId,
        supplierId: supplier.id,
        supplierName: supplier.name,
        reference: input.reference ?? null,
        subtotal: totals.subtotal,
        freight: input.freight,
        discount: input.discount,
        total: totals.total,
        registeredBy: actor.username,
        notes: input.notes,
      },
    });
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i],
        calculated = totals.lines[i],
        product = products[i],
        itemId = randomUUID();
      await tx.purchaseItem.create({
        data: {
          id: itemId,
          purchaseId,
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          packaging: item.packaging,
          factor: item.factor,
          acceptedPackages: item.acceptedPackages,
          refusedPackages: item.refusedPackages,
          quantity: calculated.quantity,
          packagePrice: item.packagePrice,
          goodsTotal: calculated.goodsTotal,
          totalCost: calculated.totalCost,
        },
      });
      if (calculated.quantity) {
        const lot = await tx.stockLot.create({
          data: {
            id: randomUUID(),
            productId: product.id,
            purchaseItemId: itemId,
            code: item.code,
            expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
            origin: "purchase",
            quantity: 0,
            receivedQuantity: calculated.quantity,
            remainingValue: 0,
            unitCost: D(calculated.totalCost)
              .div(calculated.quantity)
              .toDecimalPlaces(6),
          },
        });
        await lotMovement(
          tx,
          actor,
          lot.id,
          calculated.quantity,
          `Compra ${purchaseId}`,
          "purchase",
          purchaseId,
          calculated.totalCost,
        );
        await projectStock(
          tx,
          product.id,
          D(calculated.totalCost).div(calculated.quantity),
        );
      }
    }
    let expenseId: string | null = null;
    if (totals.total > 0) {
      expenseId = randomUUID();
      await tx.expense.create({
        data: {
          id: expenseId,
          sourcePurchaseId: purchaseId,
          supplierId: supplier.id,
          description: `Compra de bebidas · ${supplier.name}${input.reference ? " · " + input.reference : ""}`,
          category: "Compras de bebidas",
          value: totals.total,
          dueDate: new Date(input.dueDate),
          installments: input.installments
            ? {
                create: input.installments.map((p, i) => ({
                  id: randomUUID(),
                  installmentNumber: i + 1,
                  value: p.value,
                  dueDate: new Date(p.dueDate),
                })),
              }
            : undefined,
        },
      });
      if (input.payNow)
        await payExpense(tx, actor, {
          expenseId,
          payments: input.payments,
          paymentMethod: input.paymentMethod,
          accountId: input.accountId,
        });
    }
    await audit(tx, actor, "Compra recebida", purchaseId, {
      total: totals.total,
      expenseId,
    });
    return { id: purchaseId, expenseId };
  }
  if (kind === "stock-opening") {
    const input = z
        .object({
          productId: id,
          quantity: qty.refine((n) => n > 0),
          totalCost: money,
          ...expiry,
          reason,
        })
        .strict()
        .parse(payload),
      product = await stockProduct(tx, input.productId);
    checkExpiry(product, input.expiresAt);
    await quarantineUnmappedStock(tx);
    const lot = await tx.stockLot.create({
      data: {
        id: randomUUID(),
        productId: product.id,
        code: input.code,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        origin: "opening",
        quantity: 0,
        receivedQuantity: input.quantity,
        remainingValue: 0,
        unitCost: D(input.totalCost).div(input.quantity).toDecimalPlaces(6),
        reason: input.reason,
      },
    });
    await lotMovement(
      tx,
      actor,
      lot.id,
      input.quantity,
      input.reason,
      "opening",
      lot.id,
      input.totalCost,
    );
    await audit(tx, actor, "Abertura de estoque", lot.id, {
      reason: input.reason,
    });
    return { id: lot.id };
  }
  if (kind === "lot-review") {
    const input = z
        .object({
          lotId: id,
          recordVersion: version,
          ...expiry,
          status: z.enum(["active", "blocked"]),
          reason,
        })
        .strict()
        .parse(payload),
      lot = await tx.stockLot.findUniqueOrThrow({
        where: { id: input.lotId },
        include: { product: true },
      });
    requireVersion(input.recordVersion, lot.recordVersion);
    // Expired goods may be documented/blocked, but can never become saleable.
    if (
      input.status === "active" &&
      lot.product.requiresExpiry &&
      !input.expiresAt
    )
      throw new HttpError(400, "Informe a validade real para liberar o lote");
    if (
      lot.status !== "unverified" &&
      (input.code !== lot.code ||
        (input.expiresAt ?? null) !==
          (lot.expiresAt?.toISOString().slice(0, 10) ?? null))
    )
      throw new HttpError(
        409,
        "Lote aprovado preserva identificação e validade; bloqueie e faça uma revisão de inventário",
      );
    await tx.stockLot.update({
      where: { id: lot.id },
      data: {
        code: input.code,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        status: input.status,
        reason: input.reason,
      },
    });
    await audit(tx, actor, "Lote revisado", lot.id, {
      reason: input.reason,
      status: input.status,
    });
    return { success: true };
  }
  if (kind === "stock-loss" || kind === "purchase-return") {
    const input = z
        .object({
          lotId: id,
          recordVersion: version,
          quantity: qty.refine((n) => n > 0),
          reason,
        })
        .strict()
        .parse(payload),
      lot = await tx.stockLot.findUniqueOrThrow({ where: { id: input.lotId } });
    requireVersion(input.recordVersion, lot.recordVersion);
    await stockProduct(tx, lot.productId);
    if (kind === "purchase-return" && !lot.purchaseItemId)
      throw new HttpError(
        409,
        "Devolução ao fornecedor exige lote originado em compra",
      );
    const returnId = randomUUID(),
      result = await lotMovement(
        tx,
        actor,
        lot.id,
        -input.quantity,
        input.reason,
        kind === "stock-loss" ? "loss" : "supplier-return",
        returnId,
      );
    if (kind === "purchase-return")
      await tx.purchaseReturn.create({
        data: {
          id: returnId,
          lotId: lot.id,
          quantity: input.quantity,
          stockValue: result.value,
          reason: input.reason,
          registeredBy: actor.username,
        },
      });
    await audit(
      tx,
      actor,
      kind === "stock-loss"
        ? "Perda registrada"
        : "Mercadoria devolvida ao fornecedor",
      returnId,
      { reason: input.reason },
    );
    return { id: returnId };
  }
  if (kind === "return-settle") {
    const input = z
      .object({
        returnId: id,
        recordVersion: version,
        resolution: z.enum(["none", "discount", "refund"]),
        value: money,
        installmentId: id.optional(),
        reason,
        ...paymentFields,
      })
      .strict()
      .parse(payload);
    const returned = await tx.purchaseReturn.findUniqueOrThrow({
      where: { id: input.returnId },
      include: {
        lot: {
          include: {
            purchaseItem: {
              include: {
                purchase: {
                  include: { expense: { include: { installments: true } } },
                },
              },
            },
          },
        },
      },
    });
    requireVersion(input.recordVersion, returned.recordVersion);
    if (returned.status !== "pending")
      throw new HttpError(409, "Acerto já registrado");
    const expense = returned.lot.purchaseItem?.purchase.expense;
    if (
      (input.resolution === "none" && input.value !== 0) ||
      (input.resolution !== "none" &&
        (input.value <= 0 || D(input.value).gt(returned.stockValue)))
    )
      throw new HttpError(
        400,
        "Valor do acordo deve corresponder à mercadoria devolvida",
      );
    if (input.resolution === "discount") {
      if (!expense) throw new HttpError(409, "Compra sem dívida a abater");
      const part = input.installmentId
        ? expense.installments.find((p) => p.id === input.installmentId)
        : undefined;
      if (
        (expense.installments.length && !part) ||
        (input.installmentId && !part)
      )
        throw new HttpError(400, "Selecione a parcela a abater");
      const target = part ?? expense;
      if (D(input.value).gt(target.value.minus(target.paidValue)))
        throw new HttpError(409, "Abatimento excede o saldo a pagar");
      if (part) {
        const value = part.value.minus(input.value);
        await tx.expenseInstallment.update({
          where: { id: part.id },
          data: { value, paid: value.equals(part.paidValue) },
        });
      }
      const value = expense.value.minus(input.value);
      await tx.expense.update({
        where: { id: expense.id },
        data: { value, paid: value.equals(expense.paidValue) },
      });
    }
    if (input.resolution === "refund") {
      demand(actor, "expenses.pay");
      if (!expense)
        throw new HttpError(409, "Compra sem pagamento para reembolsar");
      const purchaseId = expense.sourcePurchaseId!,
        otherReturns = await tx.purchaseReturn.findMany({
          where: {
            status: "settled",
            resolution: "refund",
            lot: { purchaseItem: { purchaseId } },
          },
        }),
        previous = otherReturns.reduce(
          (s, r) => s.plus(r.agreedValue ?? 0),
          D(0),
        );
      if (D(input.value).gt(expense.paidValue.minus(previous)))
        throw new HttpError(
          409,
          "Reembolso excede os pagamentos já feitos ao fornecedor",
        );
      const posted = await postPayments(
        tx,
        actor,
        `Reembolso fornecedor ${returned.id}`,
        input.value,
        input,
        "purchase-return",
        returned.id,
      );
      if (posted.change)
        throw new HttpError(
          400,
          "Reembolso deve corresponder ao valor do acordo",
        );
    }
    await tx.purchaseReturn.update({
      where: { id: returned.id },
      data: {
        status: "settled",
        resolution: input.resolution,
        agreedValue: input.value,
        settledAt: new Date(),
        settledBy: actor.username,
        settlementNote: input.reason,
      },
    });
    await audit(tx, actor, "Acerto de devolução", returned.id, {
      resolution: input.resolution,
      value: input.value,
      reason: input.reason,
    });
    return { success: true };
  }
  if (kind === "inventory-start") {
    const input = z.object({ reason }).strict().parse(payload);
    await quarantineUnmappedStock(tx);
    if (await tx.stockInventory.count({ where: { status: "open" } }))
      throw new HttpError(
        409,
        "Conclua ou cancele a contagem aberta antes de iniciar outra",
      );
    const lots = await tx.stockLot.findMany({
      where: { product: { category: { isRestaurant: false } } },
      include: { product: true },
    });
    const inventory = await tx.stockInventory.create({
      data: {
        id: randomUUID(),
        reason: input.reason,
        createdBy: actor.username,
        lines: {
          create: lots.map((l) => ({
            id: randomUUID(),
            lotId: l.id,
            productName: l.product.name,
            expectedQuantity: l.quantity,
            unitCost: l.quantity.gt(0)
              ? l.remainingValue.div(l.quantity).toDecimalPlaces(6)
              : l.unitCost,
          })),
        },
      },
    });
    await audit(tx, actor, "Corte de inventário criado", inventory.id);
    return { id: inventory.id };
  }
  if (kind === "inventory-post") {
    const input = z
        .object({
          inventoryId: id,
          recordVersion: version,
          counts: z.array(z.object({ lotId: id, quantity: qty })).max(10000),
        })
        .strict()
        .parse(payload),
      inventory = await tx.stockInventory.findUniqueOrThrow({
        where: { id: input.inventoryId },
        include: { lines: true },
      });
    requireVersion(input.recordVersion, inventory.recordVersion);
    if (inventory.status !== "open")
      throw new HttpError(409, "Inventário já encerrado");
    if (
      input.counts.length !== inventory.lines.length ||
      new Set(input.counts.map((c) => c.lotId)).size !== input.counts.length ||
      inventory.lines.some(
        (l) => !input.counts.some((c) => c.lotId === l.lotId),
      )
    )
      throw new HttpError(400, "Informe cada lote do corte uma única vez");
    for (const line of inventory.lines) {
      const count = input.counts.find((c) => c.lotId === line.lotId)!,
        delta = D(count.quantity).minus(line.expectedQuantity);
      if (!delta.isZero())
        await lotMovement(
          tx,
          actor,
          line.lotId,
          delta,
          inventory.reason,
          "inventory",
          inventory.id,
          delta.gt(0) ? line.unitCost.mul(delta).toDecimalPlaces(2) : undefined,
        );
      await tx.stockInventoryLine.update({
        where: { id: line.id },
        data: { countedQuantity: count.quantity, delta },
      });
    }
    await tx.stockInventory.update({
      where: { id: inventory.id },
      data: {
        status: "posted",
        postedBy: actor.username,
        postedAt: new Date(),
      },
    });
    await audit(tx, actor, "Inventário confirmado", inventory.id);
    return { success: true };
  }
  if (kind === "inventory-cancel") {
    const input = z
        .object({ inventoryId: id, recordVersion: version, reason })
        .strict()
        .parse(payload),
      inventory = await tx.stockInventory.findUniqueOrThrow({
        where: { id: input.inventoryId },
      });
    requireVersion(input.recordVersion, inventory.recordVersion);
    if (inventory.status !== "open")
      throw new HttpError(409, "Inventário já encerrado");
    await tx.stockInventory.update({
      where: { id: inventory.id },
      data: { status: "cancelled" },
    });
    await audit(tx, actor, "Inventário cancelado", inventory.id, {
      reason: input.reason,
    });
    return { success: true };
  }
  return undefined;
}
