import { describe, it, expect, vi } from "vitest";
import {
  canOpenSettings,
  visibleSettingsSections,
} from "@/lib/settings/sections";
import { effectivePermissions } from "@/lib/permissions";
import {
  settingsOperation,
  readSettings,
  projectRuntimeSettings,
} from "@/lib/server/settings";
import type { Prisma } from "@prisma/client";
import type { Actor } from "@/lib/server/auth";
vi.mock("@/lib/server/audit", () => ({ recordAudit: vi.fn() }));
const actor = (permissions: string[]): Actor => ({
  id: "admin",
  username: "admin",
  role: "supervisor",
  sessionId: "session",
  approvedUntil: null,
  permissions,
});
function fixture() {
  const row = {
    id: "settings",
    recordVersion: 7,
    pousadaName: "Pousada",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    discountCeiling: 20,
    contactEmail: "privado@example.com",
  };
  const tx = {
    systemSettings: {
      findFirst: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ ...row, recordVersion: 8, checkInTime: "15:00" }),
    },
    $executeRaw: vi.fn(),
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient };
}
describe("Configurações por seção", () => {
  it("entrada sozinha não libera nenhuma seção; preferências não concedem gestão global", () => {
    expect(canOpenSettings((p) => p === "settings.access")).toBe(false);
    const allowed = effectivePermissions({ accessProfile: "recepcao" });
    expect(
      visibleSettingsSections((p) => allowed.includes(p)).map((s) => s.id),
    ).toEqual(["aparencia", "avisos"]);
    expect(allowed).not.toContain("settings.commercial.edit");
  });
  it("supervisor mantém regras globais sem receber gestão de acessos", () => {
    const allowed = effectivePermissions({ accessProfile: "supervisor" });
    expect(allowed).toContain("settings.alerts.edit");
    expect(allowed).not.toContain("users.manage");
    expect(
      effectivePermissions({
        accessProfile: "administrador",
        permissionOverrides: { "settings.access": "deny" },
      }),
    ).not.toContain("settings.access");
  });
  it("leitura recusa acesso de outra seção e retorna somente campos autorizados", async () => {
    const { tx, client } = fixture();
    const reader = actor(["settings.access", "settings.lodging.read"]);
    await expect(readSettings(client, reader, "pousada")).rejects.toThrow(
      "permissão",
    );
    expect(tx.systemSettings.findFirst).not.toHaveBeenCalled();
    expect(await readSettings(client, reader, "hospedagem")).toEqual({
      section: "hospedagem",
      recordVersion: 7,
      values: { checkInTime: "14:00", checkOutTime: "12:00" },
    });
    expect(
      projectRuntimeSettings({
        id: "s",
        contactEmail: "secret",
        cnpj: "secret",
        checkInTime: "14:00",
      }),
    ).toEqual({ id: "s", checkInTime: "14:00" });
  });
  it("não salva por leitura, por edição sem leitura ou sem entrada", async () => {
    for (const perms of [
      ["settings.access", "settings.lodging.read"],
      ["settings.access", "settings.lodging.edit"],
      ["settings.lodging.read", "settings.lodging.edit"],
    ]) {
      const { tx, client } = fixture();
      await expect(
        settingsOperation(client, actor(perms), "settings-update", {
          section: "hospedagem",
          recordVersion: 7,
          values: { checkInTime: "15:00", checkOutTime: "12:00" },
        }),
      ).rejects.toThrow("permissão");
      expect(tx.systemSettings.updateMany).not.toHaveBeenCalled();
    }
  });
  it("rejeita campos de outra seção e versão obsoleta; salva somente os horários", async () => {
    const { tx, client } = fixture(),
      admin = actor(effectivePermissions({ accessProfile: "administrador" })),
      values = { checkInTime: "15:00", checkOutTime: "12:00" };
    await expect(
      settingsOperation(client, admin, "settings-update", {
        section: "hospedagem",
        recordVersion: 7,
        values: { ...values, discountCeiling: 100 },
      }),
    ).rejects.toThrow();
    await expect(
      settingsOperation(client, admin, "settings-update", {
        section: "hospedagem",
        recordVersion: 6,
        values,
      }),
    ).rejects.toThrow("outro dispositivo");
    expect(tx.systemSettings.updateMany).not.toHaveBeenCalled();
    expect(
      (
        await settingsOperation(client, admin, "settings-update", {
          section: "hospedagem",
          recordVersion: 7,
          values,
        })
      ).recordVersion,
    ).toBe(8);
    expect(tx.systemSettings.updateMany).toHaveBeenCalledWith({
      where: { id: "settings", recordVersion: 7 },
      data: { ...values, recordVersion: { increment: 1 } },
    });
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
  });
  it("restaurar exige autorização própria e não permite apagar identificação da pousada", async () => {
    const { client, tx } = fixture(),
      admin = actor(effectivePermissions({ accessProfile: "administrador" }));
    await expect(
      settingsOperation(client, admin, "settings-restore", {
        section: "pousada",
        recordVersion: 7,
      }),
    ).rejects.toThrow("indisponível");
    await expect(
      settingsOperation(
        client,
        actor(admin.permissions!.filter((p) => p !== "settings.restore")),
        "settings-restore",
        { section: "comercial", recordVersion: 7 },
      ),
    ).rejects.toThrow("permissão");
    expect(tx.systemSettings.updateMany).not.toHaveBeenCalled();
  });
});
