import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db/client";
import { executeOperation } from "@/lib/server/operations";
import { readSettings } from "@/lib/server/settings";
import { updateCollectionItem } from "@/lib/server/db/relational-data-service";
import { updateInboxPreferences } from "@/lib/server/notifications/inbox";
import { effectivePermissions } from "@/lib/permissions";
import { NextRequest } from "next/server";
import { hashToken, SESSION_COOKIE } from "@/lib/server/auth";
import { GET as settingsGET } from "@/app/api/settings/[section]/route";
import { GET as collectionGET } from "@/app/api/data/[key]/route";
import { POST as operationPOST } from "@/app/api/operations/route";
import type { Actor } from "@/lib/server/auth";
if (
  new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid")
    .pathname !== "/erp_test"
)
  throw Error("Use exclusivamente erp_test");
let admin: Actor, reader: Actor;
const tokens = new Map<string, string>();
async function user(
  id: string,
  profile: string,
  permissionOverrides: Record<string, string> = {},
) {
  const row = await prisma.user.create({
    data: {
      id,
      username: id,
      password: "not-used",
      fullName: id,
      role: "supervisor",
      accessProfile: profile,
      createdBy: "test",
      permissionOverrides,
    },
  });
  const token = randomBytes(32).toString("hex");
  tokens.set(id, token);
  const session = await prisma.authSession.create({
    data: {
      userId: id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  return {
    id,
    username: id,
    role: "supervisor" as const,
    sessionId: session.id,
    approvedUntil: null,
    permissions: effectivePermissions(row),
  };
}
beforeAll(async () => {
  await prisma.$executeRawUnsafe(
    "TRUNCATE users, system_settings, operation_receipts CASCADE",
  );
  admin = await user("settings-admin", "administrador");
  reader = await user("settings-reader", "personalizado", {
    "settings.access": "allow",
    "settings.lodging.read": "allow",
  });
});
beforeEach(async () => {
  await prisma.user.update({
    where: { id: reader.id },
    data: {
      permissionOverrides: {
        "settings.access": "allow",
        "settings.lodging.read": "allow",
      },
    },
  });
  await prisma.operationReceipt.deleteMany();
  await prisma.auditEntry.deleteMany();
  await prisma.systemSettings.deleteMany();
  await prisma.user.update({
    where: { id: admin.id },
    data: { permissionOverrides: {} },
  });
  await prisma.systemSettings.create({
    data: {
      id: "settings",
      pousadaName: "Pousada real",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      discountCeiling: 17,
      contactEmail: "contato@example.com",
    },
  });
});
afterAll(async () => {
  await prisma.$disconnect();
});
const payload = (version = 0) => ({
  section: "hospedagem",
  recordVersion: version,
  values: { checkInTime: "15:00", checkOutTime: "12:00" },
});
describe("Configurações persistidas e autorização", () => {
  it("APIs recusam sessão/origem e não expõem contato pelo endpoint operacional", async () => {
    const base = process.env.APP_URL!,
      cookie = `${SESSION_COOKIE}=${tokens.get(admin.id)}`;
    const unauthenticated = await settingsGET(
      new NextRequest(`${base}/api/settings/pousada`),
      { params: Promise.resolve({ section: "pousada" }) },
    );
    expect(unauthenticated.status).toBe(401);
    const forbidden = await settingsGET(
      new NextRequest(`${base}/api/settings/pousada`, {
        headers: { cookie: `${SESSION_COOKIE}=${tokens.get(reader.id)}` },
      }),
      { params: Promise.resolve({ section: "pousada" }) },
    );
    expect(forbidden.status).toBe(403);
    const operational = await collectionGET(
      new NextRequest(`${base}/api/data/systemSettings`, {
        headers: { cookie },
      }),
      { params: Promise.resolve({ key: "systemSettings" }) },
    );
    expect(operational.status).toBe(200);
    const rows = await operational.json();
    expect(rows[0].contactEmail).toBeUndefined();
    expect(rows[0].checkInTime).toBe("14:00");
    const wrongOrigin = await operationPOST(
      new NextRequest(`${base}/api/operations`, {
        method: "POST",
        headers: {
          cookie,
          origin: "https://origem-invalida.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: randomUUID(),
          kind: "settings-update",
          payload: payload(),
        }),
      }),
    );
    expect(wrongOrigin.status).toBe(403);
    expect(
      (
        await prisma.systemSettings.findUniqueOrThrow({
          where: { id: "settings" },
        })
      ).recordVersion,
    ).toBe(0);
  });
  it("salva só a seção, sincroniza versão e reenvio não duplica auditoria", async () => {
    const request = randomUUID(),
      result = await executeOperation(
        admin,
        request,
        "settings-update",
        payload(),
      );
    expect(result).toMatchObject({
      recordVersion: 1,
      values: { checkInTime: "15:00" },
    });
    const current = await prisma.systemSettings.findUniqueOrThrow({
      where: { id: "settings" },
    });
    expect(current.contactEmail).toBe("contato@example.com");
    expect(current.discountCeiling).toBe(17);
    expect(
      await executeOperation(admin, request, "settings-update", payload()),
    ).toEqual(result);
    expect(
      await prisma.auditEntry.count({
        where: { entityType: "systemSettings" },
      }),
    ).toBe(1);
  });
  it("leitor não altera seção, campo estranho não passa, CRUD genérico não contorna acesso", async () => {
    expect(await readSettings(prisma, reader, "hospedagem")).toMatchObject({
      values: { checkInTime: "14:00", checkOutTime: "12:00" },
    });
    await expect(readSettings(prisma, reader, "pousada")).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(
      executeOperation(reader, randomUUID(), "settings-update", payload()),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      executeOperation(admin, randomUUID(), "settings-update", {
        ...payload(),
        values: { ...payload().values, discountCeiling: 100 },
      }),
    ).rejects.toThrow();
    await expect(
      updateCollectionItem(
        "systemSettings",
        "settings",
        { recordVersion: 0, discountCeiling: 100 },
        admin,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      executeOperation(admin, randomUUID(), "admin-update", {
        key: "systemSettings",
        id: "settings",
        data: { recordVersion: 0, discountCeiling: 100 },
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (
        await prisma.systemSettings.findUniqueOrThrow({
          where: { id: "settings" },
        })
      ).recordVersion,
    ).toBe(0);
  });
  it("duas sessões não sobrescrevem versões e restaurar não apaga contato", async () => {
    const results = await Promise.allSettled([
      executeOperation(admin, randomUUID(), "settings-update", payload()),
      executeOperation(admin, randomUUID(), "settings-update", {
        section: "comercial",
        recordVersion: 0,
        values: { discountCeiling: 10 },
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    await executeOperation(admin, randomUUID(), "settings-restore", {
      section: "comercial",
      recordVersion: 1,
    });
    expect(
      (
        await prisma.systemSettings.findUniqueOrThrow({
          where: { id: "settings" },
        })
      ).contactEmail,
    ).toBe("contato@example.com");
    await expect(
      executeOperation(admin, randomUUID(), "settings-restore", {
        section: "pousada",
        recordVersion: 2,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("revogação impede escrita, recuperação de recibo e preferência pessoal na sessão antiga", async () => {
    const request = randomUUID();
    await executeOperation(admin, request, "settings-update", payload());
    await prisma.user.update({
      where: { id: admin.id },
      data: { permissionOverrides: { "settings.access": "deny" } },
    });
    await expect(
      executeOperation(admin, request, "settings-update", payload()),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      executeOperation(admin, randomUUID(), "settings-update", payload(1)),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateInboxPreferences(admin, { payments: false }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("migração conserva negações antigas, concessões personalizadas e prioridade de exceções novas", async () => {
    await prisma.user.update({
      where: { id: admin.id },
      data: { permissionOverrides: { "systemSettings.edit": "deny" } },
    });
    await prisma.user.update({
      where: { id: reader.id },
      data: {
        permissionOverrides: {
          "systemSettings.edit": "allow",
          "settings.commercial.edit": "deny",
          "settings.access": "deny",
        },
      },
    });
    const sql = await readFile(
      "prisma/migrations/20261011170000_settings_sections/migration.sql",
      "utf8",
    );
    await prisma.$executeRawUnsafe(sql);
    const denied = effectivePermissions(
        await prisma.user.findUniqueOrThrow({ where: { id: admin.id } }),
      ),
      custom = effectivePermissions(
        await prisma.user.findUniqueOrThrow({ where: { id: reader.id } }),
      );
    expect(denied).not.toContain("settings.lodging.edit");
    expect(custom).toContain("settings.lodging.edit");
    expect(custom).not.toContain("settings.commercial.edit");
    expect(custom).not.toContain("settings.access");
  });
  it("não permite retirar entrada em configurações do último administrador ativo", async () => {
    await expect(
      updateCollectionItem(
        "users",
        admin.id,
        {
          recordVersion: (
            await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })
          ).recordVersion,
          permissionOverrides: { "settings.access": "deny" },
        },
        admin,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("revogar entrada impede leitura de usuários e recuperação de recibo administrativo", async () => {
    const request = randomUUID();
    const input = {
      key: "users",
      id: reader.id,
      data: {
        recordVersion: (
          await prisma.user.findUniqueOrThrow({ where: { id: reader.id } })
        ).recordVersion,
        fullName: "Nome corrigido",
      },
    };
    await executeOperation(admin, request, "admin-update", input);
    await prisma.user.update({
      where: { id: admin.id },
      data: { permissionOverrides: { "settings.access": "deny" } },
    });
    await expect(
      executeOperation(admin, request, "admin-update", input),
    ).rejects.toMatchObject({ status: 403 });
    const result = await collectionGET(
      new NextRequest(`${process.env.APP_URL}/api/data/users`, {
        headers: { cookie: `${SESSION_COOKIE}=${tokens.get(admin.id)}` },
      }),
      { params: Promise.resolve({ key: "users" }) },
    );
    expect(result.status).toBe(403);
  });
});
