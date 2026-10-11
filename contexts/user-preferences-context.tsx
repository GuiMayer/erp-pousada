"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
export interface UserPreferences {
  enableChartAnimations: boolean;
  showRoomMetrics: boolean;
  theme: "light" | "dark" | "system";
}
const defaults: UserPreferences = {
  enableChartAnimations: true,
  showRoomMetrics: true,
  theme: "system",
};
type Context = {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  status: string;
  loaded: boolean;
};
const UserPreferencesContext = createContext<Context | undefined>(undefined);
function parse(value: unknown): UserPreferences {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    enableChartAnimations:
      typeof row.enableChartAnimations === "boolean"
        ? row.enableChartAnimations
        : true,
    showRoomMetrics:
      typeof row.showRoomMetrics === "boolean" ? row.showRoomMetrics : true,
    theme: ["light", "dark", "system"].includes(String(row.theme))
      ? (row.theme as UserPreferences["theme"])
      : "system",
  };
}
export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { user, can } = useAuth(),
    { setTheme } = useTheme(),
    [preferences, setPreferences] = useState(defaults),
    [loaded, setLoaded] = useState(false),
    [status, setStatus] = useState("");
  const scope = user?.id
    ? `erp:preferences:${windowOrigin()}:${user.id}`
    : undefined;
  useEffect(() => {
    setLoaded(false);
    let next = defaults;
    try {
      if (scope && user) {
        let raw = localStorage.getItem(scope);
        const ownerKey = `erp:legacy-preferences-owner:${window.location.origin}`,
          owner = localStorage.getItem(ownerKey),
          legacy = localStorage.getItem("userPreferences");
        if (!raw && legacy && (!owner || owner === user.id)) {
          const old = JSON.parse(legacy);
          next = parse({ ...old, theme: localStorage.getItem("theme") });
          localStorage.setItem(ownerKey, user.id);
          localStorage.setItem(scope, JSON.stringify(next));
          raw = JSON.stringify(next);
        }
        if (raw) next = parse(JSON.parse(raw));
      }
      setStatus("");
    } catch {
      setStatus("Não foi possível carregar as preferências deste navegador.");
    }
    setPreferences(next);
    if (user) setTheme(next.theme);
    setLoaded(true);
  }, [scope, user, setTheme]);
  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => {
    if (
      !loaded ||
      !scope ||
      !can("settings.access") ||
      !can("settings.personal.edit")
    ) {
      setStatus("Sem permissão para alterar suas preferências.");
      return;
    }
    const next = parse({ ...preferences, [key]: value });
    try {
      localStorage.setItem(scope, JSON.stringify(next));
      setPreferences(next);
      if (key === "theme") setTheme(next.theme);
      setStatus("Salvo neste navegador.");
    } catch {
      setStatus("Não foi possível salvar neste navegador. Tente novamente.");
    }
  };
  return (
    <UserPreferencesContext.Provider
      value={{ preferences, updatePreference, status, loaded }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}
function windowOrigin() {
  return typeof window === "undefined" ? "local" : window.location.origin;
}
export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context)
    throw Error(
      "useUserPreferences must be used within UserPreferencesProvider",
    );
  return context;
}
