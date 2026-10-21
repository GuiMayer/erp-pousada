"use client";
import { useUserPreferences } from "@/contexts/user-preferences-context";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
export function AppearanceSection() {
  const { preferences, updatePreference, status, loaded } =
    useUserPreferences();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="theme-select">Tema</Label>
        <select
          id="theme-select"
          className="min-h-11 w-full rounded-md border bg-background px-3"
          disabled={!loaded}
          value={preferences.theme}
          onChange={(e) =>
            updatePreference(
              "theme",
              e.target.value as typeof preferences.theme,
            )
          }
        >
          <option value="light">Claro</option>
          <option value="dark">Escuro</option>
          <option value="system">Acompanhar o sistema</option>
        </select>
      </div>
      {(
        [
          [
            "enableChartAnimations",
            "Animações dos gráficos",
            "Ativar animações ao carregar visualizações.",
          ],
          [
            "showRoomMetrics",
            "Métricas do mapa",
            "Mostrar o resumo de quartos no mapa.",
          ],
        ] as const
      ).map(([key, label, description]) => (
        <div
          key={key}
          className="flex min-h-11 items-center justify-between gap-4 border-b pb-5"
        >
          <div className="space-y-1">
            <Label htmlFor={key}>{label}</Label>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Switch
            id={key}
            disabled={!loaded}
            checked={preferences[key]}
            onCheckedChange={(value) => updatePreference(key, value)}
          />
        </div>
      ))}
      <p className="text-sm text-muted-foreground">
        Estas preferências pertencem ao seu usuário neste navegador e são salvas
        automaticamente.
      </p>
      {status && (
        <p role="status" className="text-sm">
          {status}
        </p>
      )}
    </div>
  );
}
