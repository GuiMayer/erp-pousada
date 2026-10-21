"use client";
import { useEffect, useRef, useState } from "react";
import { useActiveTab } from "@/contexts/active-tab-context";
import { useNotifications } from "@/lib/notification-context";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { NotificationPreferences } from "@/lib/types/notifications";
export function PersonalNotificationsSection() {
  const { preferences, updatePreferences, permission, error } =
      useNotifications(),
    [pending, setPending] = useState(false),
    [status, setStatus] = useState(""),
    busy = useRef(false);
  const { registerNavigationGuard } = useActiveTab();
  useEffect(
    () => registerNavigationGuard(() => !busy.current),
    [registerNavigationGuard],
  );
  const change = async (key: keyof NotificationPreferences, value: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setStatus("Salvando…");
    try {
      const ok = await updatePreferences({ [key]: value });
      setStatus(ok ? "Avisos salvos." : "Não foi possível salvar seus avisos.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <div className="space-y-5">
      <fieldset disabled={pending} className="space-y-4">
        {(
          [
            ["enabled", "Receber avisos comuns"],
            ["checkInOut", "Check-in e check-out"],
            ["payments", "Pagamentos"],
            ["reservations", "Reservas"],
            ["cleaning", "Limpeza"],
            ["posRestaurant", "Vendas de bebidas"],
            ["stock", "Estoque"],
            ["cash", "Caixa"],
            ["browserNotifications", "Notificações neste navegador"],
          ] as const
        )
          .filter(([key]) => preferences.enabled || key === "enabled")
          .map(([key, label]) => (
            <div
              key={key}
              className="flex min-h-11 items-center justify-between gap-4 rounded border p-3"
            >
              <Label htmlFor={`notice-${key}`}>{label}</Label>
              <Switch
                id={`notice-${key}`}
                checked={preferences[key]}
                onCheckedChange={(value) => void change(key, value)}
              />
            </div>
          ))}
      </fieldset>
      <p className="text-xs text-muted-foreground">
        Alertas críticos ativos permanecem visíveis mesmo com avisos comuns
        desativados. As regras globais são configuradas em Regras de alertas.
      </p>
      <p className="text-sm">
        Permissão do navegador:{" "}
        {
          {
            granted: "concedida",
            denied: "negada nas configurações do navegador",
            default: "ainda não solicitada",
            unsupported: "indisponível",
          }[permission]
        }
        .
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="text-sm">
          {status}
        </p>
      )}
    </div>
  );
}
