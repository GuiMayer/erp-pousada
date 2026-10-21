import type { Prisma } from "@prisma/client";
import type { Actor } from "./auth";
import { demand } from "./permissions";
import { HttpError } from "./http";
import { requireVersion } from "./concurrency";
import { recordAudit } from "./audit";
import {
  GLOBAL_SECTIONS,
  globalSection,
  selectSectionFields,
  type GlobalSectionId,
} from "@/lib/settings/sections";
import {
  parseSettingsValues,
  sectionPermission,
  settingsInput,
} from "@/lib/settings/schemas";
import { initialSystemSettings } from "@/lib/store";
import { ruleSchema } from "@/lib/notification-policy";

export function demandSettings(
  actor: Actor,
  section: string,
  write = false,
  restore = false,
) {
  if (!globalSection(section))
    throw new HttpError(404, "Seção de configuração inexistente");
  demand(actor, "settings.access");
  demand(actor, sectionPermission(section as GlobalSectionId, "read"));
  if (write)
    demand(actor, sectionPermission(section as GlobalSectionId, "edit"));
  if (restore) demand(actor, "settings.restore");
}
export async function readSettings(
  tx: Prisma.TransactionClient,
  actor: Actor,
  section: string,
) {
  demandSettings(actor, section);
  const row = await tx.systemSettings.findFirst();
  if (!row)
    throw new HttpError(
      409,
      "Configuração inicial ausente. Solicite a preparação ao administrador.",
    );
  return {
    section,
    recordVersion: row.recordVersion,
    values: selectSectionFields(
      section as GlobalSectionId,
      row as unknown as Record<string, unknown>,
    ),
  };
}
export async function settingsOperation(
  tx: Prisma.TransactionClient,
  actor: Actor,
  kind: string,
  payload: unknown,
) {
  const input = settingsInput.parse(payload);
  demandSettings(actor, input.section, true, kind === "settings-restore");
  if (
    kind === "settings-restore" &&
    (!GLOBAL_SECTIONS[input.section].restorable || input.values !== undefined)
  )
    throw new HttpError(400, "Restauração indisponível para esta seção");
  const values = parseSettingsValues(
    input.section,
    kind === "settings-restore"
      ? selectSectionFields(input.section, {
          ...initialSystemSettings,
          notificationRules: ruleSchema.parse({}),
        })
      : input.values,
  );
  const current = await tx.systemSettings.findFirst();
  if (!current) throw new HttpError(409, "Configuração inicial ausente");
  requireVersion(input.recordVersion, current.recordVersion);
  const changed = await tx.systemSettings.updateMany({
    where: { id: current.id, recordVersion: input.recordVersion },
    data: { ...values, recordVersion: { increment: 1 } },
  });
  if (!changed.count)
    throw new HttpError(
      409,
      "Configuração alterada em outra sessão. Revise sua edição.",
    );
  const saved = await tx.systemSettings.findUniqueOrThrow({
    where: { id: current.id },
  });
  await recordAudit(
    tx,
    actor,
    kind === "settings-restore"
      ? "Padrões da seção restaurados"
      : "Configuração da seção alterada",
    input.section,
    {
      entityType: "systemSettings",
      entityId: current.id,
      operation: "update",
      metadata: {
        section: input.section,
        before: selectSectionFields(
          input.section,
          current as unknown as Record<string, unknown>,
        ),
        after: values,
      },
    },
  );
  await tx.$executeRaw`SELECT pg_notify('erp_sync', 'systemSettings')`;
  return {
    section: input.section,
    recordVersion: saved.recordVersion,
    values: selectSectionFields(
      input.section,
      saved as unknown as Record<string, unknown>,
    ),
  };
}

/** Operational clients only receive runtime settings; administrative fields require their section. */
export function projectRuntimeSettings(row: Record<string, unknown>) {
  return Object.fromEntries(
    [
      "id",
      "recordVersion",
      "pousadaName",
      "checkInTime",
      "checkOutTime",
      "discountCeiling",
      "logoUrl",
    ]
      .filter((key) => Object.hasOwn(row, key))
      .map((key) => [key, row[key]]),
  );
}
