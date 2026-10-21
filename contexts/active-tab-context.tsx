"use client";
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { StockDestination } from "@/lib/notification-destination";
import { useAuth } from "@/lib/auth-context";
import { canAccessTab } from "@/lib/permissions";
type TabValue =
  | "cadastros"
  | "mapa"
  | "reservas"
  | "pdv"
  | "estoque"
  | "financeiro"
  | "relatorios"
  | "configuracoes"
  | "administracao"
  | "auditoria";
type Guard = (proceed: () => void) => boolean;
interface ActiveTabContextType {
  activeTab: TabValue;
  setActiveTab: (tab: TabValue) => void;
  stockDestination?: StockDestination;
  openStock: (destination: StockDestination) => void;
  settingsSection?: string;
  setSettingsSection: (section?: string) => void;
  registerNavigationGuard: (guard: Guard) => () => void;
}
const ActiveTabContext = createContext<ActiveTabContextType | undefined>(
  undefined,
);
export function useStockNavigation() {
  return useContext(ActiveTabContext);
}
export function useActiveTab() {
  const context = useContext(ActiveTabContext);
  if (!context)
    throw Error("useActiveTab must be used within ActiveTabProvider");
  return context;
}
export function ActiveTabProvider({ children }: { children: ReactNode }) {
  const { can } = useAuth();
  const [activeTab, updateTab] = useState<TabValue>("mapa"),
    [stockDestination, setStockDestination] = useState<StockDestination>(),
    [settingsSection, updateSection] = useState<string>();
  const guardRef = useRef<Guard | null>(null),
    urlRef = useRef("");
  const registerNavigationGuard = useCallback((guard: Guard) => {
    guardRef.current = guard;
    return () => {
      if (guardRef.current === guard) guardRef.current = null;
    };
  }, []);
  const apply = useCallback(
    (
      tab: TabValue,
      section?: string,
      destination?: StockDestination,
      mode: "push" | "replace" | "none" = "push",
    ) => {
      const target = tab === "administracao" ? "configuracoes" : tab;
      if (!canAccessTab(target, can)) return;
      updateTab(target);
      updateSection(section);
      setStockDestination(destination);
      const url = new URL(window.location.href);
      url.searchParams.set("modulo", target);
      if (target === "configuracoes" && section)
        url.searchParams.set("secao", section);
      else url.searchParams.delete("secao");
      if (mode !== "none" && url.href !== window.location.href)
        window.history[mode === "push" ? "pushState" : "replaceState"](
          null,
          "",
          url,
        );
      urlRef.current = url.href;
    },
    [can],
  );
  const navigate = useCallback(
    (tab: TabValue, section?: string, destination?: StockDestination) => {
      const proceed = () => apply(tab, section, destination);
      if (!guardRef.current || guardRef.current(proceed)) proceed();
    },
    [apply],
  );
  const setActiveTab = useCallback(
    (tab: TabValue) =>
      navigate(tab, tab === "administracao" ? "usuarios" : undefined),
    [navigate],
  );
  const setSettingsSection = useCallback(
    (section?: string) => navigate("configuracoes", section),
    [navigate],
  );
  const openStock = useCallback(
    (destination: StockDestination) =>
      navigate("estoque", undefined, { ...destination }),
    [navigate],
  );
  useEffect(() => {
    const resolve = (initial = false) => {
      const url = new URL(window.location.href),
        tab = (url.searchParams.get("modulo") || "mapa") as TabValue,
        section = url.searchParams.get("secao") || undefined;
      const proceed = () =>
        apply(
          tab,
          tab === "administracao" ? section || "usuarios" : section,
          undefined,
          "replace",
        );
      if (!initial && guardRef.current && !guardRef.current(proceed)) {
        window.history.replaceState(null, "", urlRef.current);
        return;
      }
      if (canAccessTab(tab, can)) proceed();
      else {
        const fallback = [
          "mapa",
          "reservas",
          "pdv",
          "estoque",
          "cadastros",
          "financeiro",
          "relatorios",
          "configuracoes",
          "auditoria",
        ].find((t) => canAccessTab(t, can));
        if (fallback)
          apply(fallback as TabValue, undefined, undefined, "replace");
      }
    };
    resolve(true);
    const pop = () => resolve();
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [apply, can]);
  return (
    <ActiveTabContext.Provider
      value={{
        activeTab,
        setActiveTab,
        stockDestination,
        openStock,
        settingsSection,
        setSettingsSection,
        registerNavigationGuard,
      }}
    >
      {children}
    </ActiveTabContext.Provider>
  );
}
