"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { useActiveTab } from "@/contexts/active-tab-context";
import { useTaskState } from "@/contexts/task-drafts-context";
import { getDataConfig } from "@/lib/data/config";
import {
  GLOBAL_SECTIONS,
  selectSectionFields,
  type GlobalSectionId,
} from "@/lib/settings/sections";
import { SECTION_SCHEMAS, sectionPermission } from "@/lib/settings/schemas";
import { initialSystemSettings, type SystemSettings } from "@/lib/store";
import { ruleSchema } from "@/lib/notification-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
type Snapshot = { recordVersion: number; values: Record<string, unknown> };
type Draft = { baseline: Snapshot; values: Record<string, unknown> };
const labels: Record<string, string> = {
  pousadaName: "Nome da pousada",
  contactPhone: "Telefone",
  contactEmail: "E-mail",
  address: "Endereço",
  cnpj: "CNPJ",
  razaoSocial: "Razão social",
  inscricaoEstadual: "Inscrição estadual",
  logoUrl: "URL do logotipo",
  checkInTime: "Horário de check-in",
  checkOutTime: "Horário de check-out",
  discountCeiling: "Teto de desconto (%)",
  notifyCheckInReminder: "Lembretes de check-in",
  notifyCheckOutReminder: "Lembretes de check-out",
  notifyLowStock: "Avisos de estoque baixo",
  notifyPendingPayments: "Avisos de pagamentos pendentes",
};
const ruleLabels: Record<string, string> = {
  stockCriticalLevel: "Estoque crítico (% do mínimo)",
  stockLowLevel: "Estoque baixo (% do mínimo)",
  cashDifferenceWarning: "Diferença de caixa: aviso (R$)",
  cashDifferenceCritical: "Diferença de caixa: crítico (R$)",
};
function normalize(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    values: {
      ...snapshot.values,
      ...(snapshot.values.notificationRules !== undefined
        ? {
            notificationRules: ruleSchema.parse(
              snapshot.values.notificationRules ?? {},
            ),
          }
        : {}),
    },
  };
}
export function GlobalSettingsSection({
  section,
}: {
  section: GlobalSectionId;
}) {
  const { systemSettings, updateSystemSettings, runOperation } = useApp(),
    { can } = useAuth(),
    { registerNavigationGuard } = useActiveTab();
  const [draft, setDraft] = useTaskState<Draft | null>(
    `settings.${section}.draft`,
    null,
    false,
  );
  const [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState(""),
    [latest, setLatest] = useState<Snapshot | null>(null),
    [exit, setExit] = useState<(() => void) | null>(null),
    [restoreOpen, setRestoreOpen] = useState(false);
  const pendingRef = useRef(false),
    formRef = useRef<HTMLFormElement>(null);
  const editable =
    can("settings.access") &&
    can(sectionPermission(section, "read")) &&
    can(sectionPermission(section, "edit"));
  const dirty =
    !!draft &&
    JSON.stringify(draft.values) !== JSON.stringify(draft.baseline.values);
  const load = useCallback(async (): Promise<Snapshot> => {
    if (getDataConfig().adapter === "demo-localStorage")
      return normalize({
        recordVersion: systemSettings.recordVersion ?? 0,
        values: selectSectionFields(
          section,
          systemSettings as unknown as Record<string, unknown>,
        ),
      });
    const response = await fetch(`/api/settings/${section}`, {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok)
      throw Error(result.error || "Não foi possível carregar as configurações");
    return normalize(result);
  }, [section, systemSettings]);
  useEffect(() => {
    let current = true;
    if (!draft)
      void load()
        .then((snapshot) => {
          if (current)
            setDraft({ baseline: snapshot, values: snapshot.values });
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
  }, [draft, load, setDraft]);
  useEffect(
    () =>
      registerNavigationGuard((proceed) => {
        if (pendingRef.current) return false;
        if (dirty && editable) {
          setExit(() => proceed);
          return false;
        }
        return true;
      }),
    [dirty, editable, registerNavigationGuard],
  );
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty && editable) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, editable]);
  useEffect(() => {
    let current = true;
    if (
      draft &&
      !dirty &&
      !pending &&
      typeof systemSettings.recordVersion === "number" &&
      systemSettings.recordVersion > draft.baseline.recordVersion
    ) {
      void load()
        .then((snapshot) => {
          if (current)
            setDraft({ baseline: snapshot, values: snapshot.values });
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    }
    return () => {
      current = false;
    };
  }, [draft, dirty, pending, systemSettings.recordVersion, load, setDraft]);
  const save = async (restore = false): Promise<boolean> => {
    if (
      !draft ||
      pendingRef.current ||
      !editable ||
      (restore && !can("settings.restore"))
    )
      return false;
    const parsed = SECTION_SCHEMAS[section].safeParse(draft.values);
    if (!restore && !parsed.success) {
      const next = Object.fromEntries(
        parsed.error.issues.map((issue) => [
          String(issue.path[0] ?? "form"),
          issue.message,
        ]),
      );
      setErrors(next);
      setError("Revise os campos indicados.");
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return false;
    }
    pendingRef.current = true;
    setPending(true);
    setError("");
    setErrors({});
    setNotice("");
    try {
      let result: Snapshot;
      if (getDataConfig().adapter === "demo-localStorage") {
        if (
          (systemSettings.recordVersion ?? 0) !== draft.baseline.recordVersion
        )
          throw Error(
            "Configuração alterada em outra sessão. Revise sua edição.",
          );
        const values = restore
          ? selectSectionFields(section, {
              ...initialSystemSettings,
              notificationRules: ruleSchema.parse({}),
            })
          : parsed.success
            ? parsed.data
            : {};
        await updateSystemSettings({
          ...values,
          recordVersion: draft.baseline.recordVersion + 1,
        } as Partial<SystemSettings>);
        result = normalize({
          recordVersion: draft.baseline.recordVersion + 1,
          values,
        });
      } else
        result = normalize(
          await runOperation<Snapshot>(
            restore ? "settings-restore" : "settings-update",
            {
              section,
              recordVersion: draft.baseline.recordVersion,
              ...(!restore
                ? { values: parsed.success ? parsed.data : {} }
                : {}),
            },
          ),
        );
      setDraft({ baseline: result, values: result.values });
      setLatest(null);
      setRestoreOpen(false);
      setNotice(
        restore ? "Padrões desta seção restaurados." : "Alterações salvas.",
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  const discard = () => {
    if (draft) setDraft({ ...draft, values: draft.baseline.values });
    setError("");
    setErrors({});
    setNotice("Alterações descartadas.");
    setLatest(null);
  };
  const change = (field: string, value: unknown) => {
    if (!draft || pendingRef.current || !editable) return;
    setDraft({ ...draft, values: { ...draft.values, [field]: value } });
    setNotice("");
    setErrors((old) => {
      const next = { ...old };
      delete next[field];
      return next;
    });
  };
  const refresh = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      const snapshot = await load();
      if (dirty) setLatest(snapshot);
      else {
        setDraft({ baseline: snapshot, values: snapshot.values });
        setNotice("Valores atualizados.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  if (!draft)
    return (
      <div className="space-y-3" role="status">
        {error || "Carregando configurações…"}
        {error && (
          <Button
            variant="outline"
            onClick={() =>
              void load()
                .then((snapshot) => {
                  setDraft({ baseline: snapshot, values: snapshot.values });
                  setError("");
                })
                .catch((e) => setError(e.message))
            }
          >
            Tentar novamente
          </Button>
        )}
      </div>
    );
  return (
    <>
      {!editable && (
        <p className="rounded border p-3 text-sm" role="status">
          Acesso somente para consulta. O administrador controla a permissão de
          alteração.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          Versão {draft.baseline.recordVersion}
        </span>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => void refresh()}
        >
          Atualizar valores
        </Button>
      </div>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-5"
      >
        <fieldset
          disabled={pending || !editable}
          className="grid min-w-0 gap-5 sm:grid-cols-2"
        >
          {GLOBAL_SECTIONS[section].fields
            .filter((field) => field !== "notificationRules")
            .map((field) => {
              const value = draft.values[field],
                boolean = field.startsWith("notify"),
                type = field.endsWith("Time")
                  ? "time"
                  : field === "discountCeiling"
                    ? "number"
                    : field === "contactEmail"
                      ? "email"
                      : "text";
              return (
                <div
                  key={field}
                  className={
                    field === "address" || field === "pousadaName"
                      ? "space-y-2 sm:col-span-2"
                      : "space-y-2"
                  }
                >
                  <Label htmlFor={`setting-${field}`}>{labels[field]}</Label>
                  {boolean ? (
                    <label className="flex min-h-11 items-center gap-3 rounded border px-3">
                      <input
                        id={`setting-${field}`}
                        type="checkbox"
                        checked={!!value}
                        onChange={(e) => change(field, e.target.checked)}
                      />
                      {value ? "Ativado" : "Desativado"}
                    </label>
                  ) : (
                    <Input
                      id={`setting-${field}`}
                      className="min-h-11"
                      type={type}
                      value={String(value ?? "")}
                      aria-invalid={!!errors[field]}
                      aria-describedby={
                        errors[field] ? `error-${field}` : undefined
                      }
                      min={type === "number" ? 0 : undefined}
                      max={type === "number" ? 100 : undefined}
                      onChange={(e) =>
                        change(
                          field,
                          type === "number"
                            ? e.target.value === ""
                              ? ""
                              : Number(e.target.value)
                            : e.target.value,
                        )
                      }
                    />
                  )}
                  {errors[field] && (
                    <p
                      id={`error-${field}`}
                      className="text-sm text-destructive"
                    >
                      {errors[field]}
                    </p>
                  )}
                  {field === "cnpj" && (
                    <p className="text-xs text-muted-foreground">
                      Identificação empresarial; o sistema não emite documentos
                      fiscais.
                    </p>
                  )}
                </div>
              );
            })}
          {section === "alertas" && (
            <section
              className="space-y-4 sm:col-span-2"
              aria-label="Limites dos alertas"
            >
              <h3 className="font-medium">Limites operacionais</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(ruleLabels).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`rule-${key}`}>{label}</Label>
                    <Input
                      id={`rule-${key}`}
                      type="number"
                      min={0}
                      step="0.1"
                      className="min-h-11"
                      aria-invalid={!!errors.notificationRules}
                      value={String(
                        (
                          draft.values.notificationRules as Record<
                            string,
                            unknown
                          >
                        )?.[key] ?? "",
                      )}
                      onChange={(e) =>
                        change("notificationRules", {
                          ...(draft.values.notificationRules as object),
                          [key]:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              {errors.notificationRules && (
                <p className="text-sm text-destructive">
                  {errors.notificationRules}
                </p>
              )}
            </section>
          )}
        </fieldset>
        {error && (
          <div
            role="alert"
            className="space-y-3 rounded border border-destructive p-3 text-sm"
          >
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => void refresh()}
            >
              Consultar versão atual para revisão
            </Button>
          </div>
        )}
        {latest && (
          <section
            className="space-y-3 rounded border p-3 text-sm"
            aria-label="Revisão de conflito"
          >
            <p className="font-medium">
              Valores atuais da seção · versão {latest.recordVersion}
            </p>
            <dl className="space-y-2">
              {Object.entries(latest.values).map(([field, value]) => (
                <div key={field}>
                  <dt>{labels[field] ?? "Limites dos alertas"}</dt>
                  <dd className="break-words text-muted-foreground">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setDraft({ baseline: latest, values: latest.values });
                  setLatest(null);
                  setError("");
                  setErrors({});
                }}
              >
                Usar valores atuais
              </Button>
              {editable && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setDraft({ ...draft, baseline: latest });
                    setLatest(null);
                    setError("");
                    setNotice(
                      "Rascunho preservado sobre a versão revisada. Confira os campos antes de salvar.",
                    );
                  }}
                >
                  Manter meu rascunho para revisão
                </Button>
              )}
            </div>
          </section>
        )}
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        {editable && (
          <div className="flex flex-wrap gap-2 border-t bg-background py-4">
            <Button
              className="min-h-11"
              disabled={!dirty || pending}
              type="submit"
            >
              {pending ? "Salvando…" : "Salvar alterações"}
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              type="button"
              disabled={!dirty || pending}
              onClick={discard}
            >
              Descartar
            </Button>
            {GLOBAL_SECTIONS[section].restorable && can("settings.restore") && (
              <Button
                className="min-h-11"
                variant="ghost"
                type="button"
                disabled={pending}
                onClick={() => setRestoreOpen(true)}
              >
                Restaurar padrões desta seção
              </Button>
            )}
            <span className="self-center text-xs text-muted-foreground">
              {dirty
                ? "Há alterações não salvas."
                : "Sem alterações pendentes."}
            </span>
          </div>
        )}
      </form>
      <Dialog
        open={!!exit}
        onOpenChange={(open) => {
          if (!open && !pending) setExit(null);
        }}
      >
        <DialogContent busy={pending}>
          <DialogHeader>
            <DialogTitle>Há alterações não salvas</DialogTitle>
            <DialogDescription>
              Salve ou descarte esta edição antes de sair da seção.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setExit(null)}
            >
              Permanecer
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                discard();
                const proceed = exit;
                setExit(null);
                proceed?.();
              }}
            >
              Descartar e sair
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                void save().then((ok) => {
                  if (ok) {
                    const proceed = exit;
                    setExit(null);
                    proceed?.();
                  }
                })
              }
            >
              Salvar e sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={restoreOpen}
        onOpenChange={(open) => {
          if (!pending) setRestoreOpen(open);
        }}
      >
        <DialogContent busy={pending}>
          <DialogHeader>
            <DialogTitle>Restaurar os padrões desta seção?</DialogTitle>
            <DialogDescription>
              Somente{" "}
              {GLOBAL_SECTIONS[section].fields
                .map((field) => labels[field] ?? "limites dos alertas")
                .join(", ")}{" "}
              serão restaurados. As outras seções não serão alteradas. O
              rascunho desta seção será substituído.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert">{error}</p>}
          <DialogFooter>
            <Button
              disabled={pending}
              variant="outline"
              onClick={() => setRestoreOpen(false)}
            >
              Cancelar
            </Button>
            <Button disabled={pending} onClick={() => void save(true)}>
              Confirmar restauração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
