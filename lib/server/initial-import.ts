import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  parseImportCSV,
  importKinds,
  type ImportKind,
  type ImportLine,
} from "@/lib/initial-import";
import {
  normalizeDocument,
  validateCpfCnpj,
  isCPF,
  isCNPJ,
} from "@/lib/utils/cpf-cnpj-validator";
import { businessDay } from "@/lib/utils/business-values";
import { effectivePermissions } from "@/lib/permissions";
import type { Actor } from "./auth";
import { demand } from "./permissions";
import { HttpError } from "./http";
import { createCollectionItem } from "./db/relational-data-service";
import { inventoryOperation } from "./inventory-operations";
import { recordAudit } from "./audit";
import { evaluateStock, evaluateTimed } from "./notifications/rules";
type Tx = Prisma.TransactionClient;
const previewInput = z
  .object({ kind: z.enum(importKinds), csv: z.string().max(131072) })
  .strict();
const bool = (v: string) => {
  if (!["sim", "nao", "não"].includes(v.toLowerCase()))
    throw Error("Use sim/não nos campos de controle");
  return v.toLowerCase() === "sim";
};
const number = (v: string, places: number) => {
  if (!new RegExp(`^\\d{1,9}(?:[.,]\\d{1,${places}})?$`).test(v))
    throw Error(
      `Valor inválido; use até ${places} casas, sem separador de milhar`,
    );
  return Number(v.replace(",", "."));
};
function access(actor: Actor, kind: ImportKind) {
  demand(actor, "data.import");
  if (kind === "people") {
    demand(actor, "customers.create");
    demand(actor, "customers.read");
  } else if (kind === "products") {
    demand(actor, "posProducts.create");
    demand(actor, "posProducts.read");
    demand(actor, "productCategories.read");
  } else {
    demand(actor, "stock.opening");
    demand(actor, "stockLots.read");
    demand(actor, "posProducts.read");
  }
}
async function freshActor(tx: Tx, actor: Actor) {
  const user = await tx.user.findUnique({ where: { id: actor.id } }),
    session = await tx.authSession.findUnique({
      where: { id: actor.sessionId },
    });
  if (
    !user?.active ||
    !session ||
    session.userId !== actor.id ||
    session.expiresAt <= new Date()
  )
    throw new HttpError(401, "Sessão expirada");
  return {
    ...actor,
    permissions: effectivePermissions(user),
    permissionOverrides:
      user.permissionOverrides as Actor["permissionOverrides"],
  };
}
async function inspect(
  tx: Tx,
  actor: Actor,
  kind: ImportKind,
  records: Record<string, string>[],
): Promise<ImportLine[]> {
  const seen = new Map<string, number>();
  const keys = records.map((r) =>
    kind === "people"
      ? normalizeDocument(r.documento)
      : kind === "products"
        ? r.codigo_barras || `${r.categoria}:${r.nome}`
        : `${r.codigo_barras || r.produto}:${r.lote}`,
  );
  keys.forEach((k) => seen.set(k, (seen.get(k) ?? 0) + 1));
  const rows: ImportLine[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i],
      row: ImportLine = {
        line: i + 2,
        label: r.nome || r.produto || "Registro",
        state: "new",
      };
    rows.push(row);
    try {
      if (seen.get(keys[i]) !== 1)
        throw Error("Identidade repetida no arquivo; revise as linhas");
      if (kind === "people") {
        const doc = normalizeDocument(r.documento),
          roleMap: Record<string, string> = {
            hospede: "guest",
            hóspede: "guest",
            pagador: "payer",
            fornecedor: "supplier",
          },
          roles = [
            ...new Set(
              r.papeis
                .toLowerCase()
                .split("|")
                .map((p) => roleMap[p.trim()]),
            ),
          ];
        if (
          !r.nome ||
          r.nome.length > 200 ||
          !validateCpfCnpj(doc) ||
          !roles.length ||
          roles.some((p) => !p)
        )
          throw Error(
            "Confira nome, CPF/CNPJ e papéis (hospede|pagador|fornecedor)",
          );
        if (roles.includes("guest") && !isCPF(doc))
          throw Error("Papel hóspede exige CPF");
        if (roles.includes("supplier")) demand(actor, "suppliers.create");
        const company = r.empresa ? normalizeDocument(r.empresa) : null;
        row.basis = { company: null };
        if (company) {
          if (!isCPF(doc) || company === doc)
            throw Error("Empresa vinculada requer pessoa física");
          const existing = await tx.customer.findFirst({
              where: { cpfCnpj: company },
            }),
            virtual = records.find(
              (c) => normalizeDocument(c.documento) === company,
            );
          if (
            !isCNPJ(company) ||
            (!existing && !virtual) ||
            (existing &&
              (!existing.active ||
                !Array.isArray(existing.roles) ||
                !existing.roles.includes("payer"))) ||
            (!existing &&
              virtual &&
              !virtual.papeis.toLowerCase().split("|").includes("pagador"))
          )
            throw Error(
              "Empresa vinculada ausente, inativa ou sem papel pagador",
            );
          row.basis = {
            company: existing
              ? { id: existing.id, version: existing.recordVersion }
              : null,
          };
        }
        if (
          r.telefone.length > 40 ||
          r.email.length > 200 ||
          (r.email && !z.string().email().safeParse(r.email).success)
        )
          throw Error("Telefone/e-mail inválido");
        const payload = {
          id: randomUUID(),
          name: r.nome,
          cpfCnpj: doc,
          roles,
          phone: r.telefone || undefined,
          email: r.email || undefined,
          active: true,
          companyDocument: company,
        };
        const existing = await tx.customer.findFirst({
          where: { cpfCnpj: doc },
          include: { company: true },
        });
        if (existing) {
          row.basis.person = {
            id: existing.id,
            version: existing.recordVersion,
          };
          if (
            existing.name !== r.nome ||
            !existing.active ||
            [...(Array.isArray(existing.roles) ? existing.roles : [])]
              .sort()
              .join() !== [...roles].sort().join() ||
            (existing.phone ?? "") !== r.telefone ||
            (existing.email ?? "") !== r.email ||
            (existing.company?.cpfCnpj ?? null) !== company
          )
            throw Error(
              "Cadastro existente diferente; revise na ficha. Não será sobrescrito",
            );
          row.state = "same";
        }
        row.payload = payload;
      } else if (kind === "products") {
        const categories = await tx.productCategory.findMany({
          where: { name: r.categoria, active: true, isRestaurant: false },
          select: { id: true, recordVersion: true },
        });
        if (categories.length !== 1)
          throw Error(
            "Categoria de bebida ausente ou ambígua; cadastre/conﬁra antes",
          );
        row.basis = { category: categories[0] };
        const price = number(r.preco, 2),
          trackStock = bool(r.controla_estoque),
          requiresExpiry = bool(r.exige_validade);
        if (
          !r.nome ||
          r.nome.length > 200 ||
          !["un", "ml", "l"].includes(r.unidade) ||
          price <= 0 ||
          (requiresExpiry && !trackStock) ||
          r.codigo_barras.length > 100
        )
          throw Error("Confira nome, unidade, preço e controle de validade");
        const payload = {
          id: randomUUID(),
          name: r.nome,
          categoryId: categories[0].id,
          unit: r.unidade,
          price,
          barcode: r.codigo_barras || undefined,
          trackStock,
          requiresExpiry,
          active: true,
        };
        const existing = await tx.pOSProduct.findMany({
          where: r.codigo_barras
            ? { barcode: r.codigo_barras }
            : { name: r.nome, categoryId: categories[0].id },
          take: 2,
        });
        if (existing.length) {
          const e = existing[0];
          row.basis.product = { id: e.id, version: e.recordVersion };
          if (
            existing.length !== 1 ||
            e.name !== r.nome ||
            e.categoryId !== payload.categoryId ||
            e.unit !== r.unidade ||
            Number(e.price) !== price ||
            e.trackStock !== trackStock ||
            e.requiresExpiry !== requiresExpiry ||
            !e.active
          )
            throw Error(
              "Produto existente diferente; revise no catálogo. Não será sobrescrito",
            );
          row.state = "same";
        }
        row.payload = payload;
      } else {
        const products = await tx.pOSProduct.findMany({
          where: {
            ...(r.codigo_barras
              ? { barcode: r.codigo_barras }
              : { name: r.produto }),
            active: true,
            trackStock: true,
            category: { isRestaurant: false },
          },
          take: 2,
        });
        if (products.length !== 1)
          throw Error(
            "Produto ausente/ambíguo ou sem controle de estoque; cadastre antes",
          );
        const product = products[0],
          quantity = number(r.quantidade, 3),
          totalCost = number(r.custo_total, 2),
          costEstimated = bool(r.custo_estimado);
        row.basis = {
          product: {
            id: product.id,
            version: product.recordVersion,
            unit: product.unit,
          },
        };
        if (
          !quantity ||
          !r.lote ||
          r.lote.length > 200 ||
          r.motivo.length < 5 ||
          r.motivo.length > 500
        )
          throw Error(
            "Informe quantidade positiva, lote e motivo (5–500 caracteres)",
          );
        if (
          (r.validade && !z.string().date().safeParse(r.validade).success) ||
          (product.requiresExpiry && !r.validade) ||
          (r.validade && r.validade < businessDay())
        )
          throw Error(
            "Validade real obrigatória quando configurada; vencido não pode ser aberto como utilizável",
          );
        if (
          await tx.stockLot.findFirst({
            where: { productId: product.id, code: r.lote, origin: "opening" },
          })
        )
          throw Error(
            "Lote de abertura já registrado; nova importação não pode repetir seu saldo",
          );
        row.payload = {
          productId: product.id,
          quantity,
          totalCost,
          code: r.lote,
          expiresAt: r.validade || undefined,
          reason: r.motivo,
          costEstimated,
        };
      }
    } catch (e) {
      row.state = "invalid";
      row.error =
        e instanceof HttpError && e.status === 403
          ? "Sem permissão para uma ação deste registro"
          : (e as Error).message;
      delete row.payload;
    }
  }
  const resolved = new Map<string, ImportLine[]>();
  for (const row of rows) {
    if (!row.payload) continue;
    const key =
      kind === "opening"
        ? `${row.payload.productId}:${row.payload.code}`
        : kind === "products"
          ? `${row.payload.categoryId}:${String(row.payload.name).toLowerCase()}`
          : String(row.payload.cpfCnpj);
    resolved.set(key, [...(resolved.get(key) ?? []), row]);
  }
  for (const duplicates of resolved.values())
    if (duplicates.length > 1)
      for (const row of duplicates) {
        row.state = "invalid";
        row.error =
          "O mesmo registro foi identificado mais de uma vez no arquivo";
        delete row.payload;
      }
  return rows;
}
const publicRows = (rows: ImportLine[]) =>
  rows.map(({ line, label, state, error }) => ({ line, label, state, error }));
export async function previewInitialImport(actor: Actor, input: unknown) {
  const q = previewInput.parse(input);
  access(actor, q.kind);
  let records: Record<string, string>[];
  try {
    records = parseImportCSV(q.csv, q.kind);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  const canonical = records
      .map((r) =>
        JSON.stringify(
          Object.fromEntries(
            Object.entries(r).sort(([a], [b]) => a.localeCompare(b)),
          ),
        ),
      )
      .sort(),
    contentHash = createHash("sha256")
      .update(JSON.stringify(canonical))
      .digest("hex");
  return prisma.$transaction(
    async (tx) => {
      actor = await freshActor(tx, actor);
      access(actor, q.kind);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74192026)`;
      const existing = await tx.initialImportBatch.findUnique({
        where: { kind_contentHash: { kind: q.kind, contentHash } },
      });
      if (existing?.state === "confirmed")
        return {
          id: existing.id,
          kind: q.kind,
          state: "confirmed",
          expiresAt: existing.expiresAt.toISOString(),
          rows: [],
          result: existing.result,
        };
      if (
        existing &&
        existing.userId !== actor.id &&
        existing.expiresAt > new Date()
      )
        throw new HttpError(
          409,
          "Esta importação está em revisão por outro responsável",
        );
      const rows = await inspect(tx, actor, q.kind, records),
        expiresAt = new Date(Date.now() + 30 * 60000),
        payload = JSON.parse(
          JSON.stringify({ records, rows }),
        ) as Prisma.InputJsonValue;
      await tx.initialImportBatch.deleteMany({
        where: {
          state: "preview",
          expiresAt: { lt: new Date() },
          id: { not: existing?.id ?? "" },
        },
      });
      const batch = await tx.initialImportBatch.upsert({
        where: { kind_contentHash: { kind: q.kind, contentHash } },
        create: {
          id: randomUUID(),
          kind: q.kind,
          contentHash,
          userId: actor.id,
          payload,
          expiresAt,
        },
        // Every revision has a distinct confirmation identity; an older preview cannot approve newer data.
        update: { id: randomUUID(), userId: actor.id, payload, expiresAt },
      });
      return {
        id: batch.id,
        kind: q.kind,
        state: "preview",
        expiresAt: expiresAt.toISOString(),
        rows: publicRows(rows),
      };
    },
    { isolationLevel: "Serializable", timeout: 30000 },
  );
}
export async function confirmInitialImport(actor: Actor, input: unknown) {
  const q = z
    .object({ id: z.string().uuid(), confirmed: z.literal(true) })
    .strict()
    .parse(input);
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74192026)`;
      actor = await freshActor(tx, actor);
      const batch = await tx.initialImportBatch.findUnique({
        where: { id: q.id },
      });
      if (!batch) throw new HttpError(404, "Prévia não encontrada");
      access(actor, z.enum(importKinds).parse(batch.kind));
      if (batch.state === "confirmed") return batch.result;
      if (batch.userId !== actor.id)
        throw new HttpError(403, "Prévia pertence a outro responsável");
      if (batch.expiresAt <= new Date())
        throw new HttpError(409, "Prévia expirou. Consulte novamente");
      const stored = batch.payload as unknown as {
        records: Record<string, string>[];
        rows: ImportLine[];
      };
      if (stored.rows.some((r) => r.state === "invalid"))
        throw new HttpError(
          409,
          "Corrija os registros rejeitados e consulte uma nova prévia",
        );
      const rows = await inspect(
        tx,
        actor,
        batch.kind as ImportKind,
        stored.records,
      );
      if (
        rows.some(
          (r, i) =>
            r.state !== stored.rows[i].state ||
            r.state === "invalid" ||
            !isDeepStrictEqual(r.basis, stored.rows[i].basis) ||
            !isDeepStrictEqual(
              JSON.parse(JSON.stringify({ ...r.payload, id: undefined })),
              JSON.parse(
                JSON.stringify({ ...stored.rows[i].payload, id: undefined }),
              ),
            ),
        )
      )
        throw new HttpError(
          409,
          "Cadastros mudaram desde a prévia. Consulte novamente",
        );
      const ordered =
        batch.kind === "people"
          ? [...rows].sort(
              (a, b) =>
                Number(!!a.payload?.companyDocument) -
                Number(!!b.payload?.companyDocument),
            )
          : rows;
      const created: string[] = [];
      for (const row of ordered) {
        if (row.state !== "new") continue;
        const payload = { ...row.payload! };
        if (batch.kind === "people") {
          const document = payload.companyDocument;
          delete payload.companyDocument;
          if (document)
            payload.companyId = (
              await tx.customer.findFirstOrThrow({
                where: { cpfCnpj: String(document) },
              })
            ).id;
          const result = (await createCollectionItem(
            "customers",
            payload,
            actor,
            tx,
          )) as { id: string };
          created.push(result.id);
        } else if (batch.kind === "products") {
          const result = (await createCollectionItem(
            "posProducts",
            payload,
            actor,
            tx,
          )) as { id: string };
          created.push(result.id);
        } else {
          const estimated = payload.costEstimated;
          delete payload.costEstimated;
          payload.reason = `Importação ${batch.id} · ${payload.reason}`.slice(
            0,
            500,
          );
          const result = (await inventoryOperation(
            tx,
            actor,
            "stock-opening",
            payload,
          )) as { id: string };
          if (estimated)
            await tx.stockLot.update({
              where: { id: result.id },
              data: { costEstimated: true },
            });
          created.push(result.id);
        }
      }
      const result = {
          id: batch.id,
          created: created.length,
          ignored: rows.length - created.length,
          origins: created,
        },
        safeResult = JSON.parse(
          JSON.stringify(result),
        ) as Prisma.InputJsonValue;
      await tx.initialImportBatch.update({
        where: { id: batch.id },
        data: { state: "confirmed", result: safeResult, payload: {} },
      });
      await recordAudit(tx, actor, "Importação inicial confirmada", batch.id, {
        entityType: "imports",
        entityId: batch.id,
        operation: "create",
        metadata: {
          kind: batch.kind,
          contentHash: batch.contentHash,
          created: created.length,
          ignored: result.ignored,
        },
      });
      if (batch.kind === "opening") {
        await evaluateStock(tx);
        await evaluateTimed(tx);
      }
      return result;
    },
    { isolationLevel: "Serializable", timeout: 60000 },
  );
}
