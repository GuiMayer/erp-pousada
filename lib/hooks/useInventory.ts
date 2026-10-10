"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import type { InventorySnapshot } from "@/lib/inventory";
const empty = (): InventorySnapshot => ({
  lots: [],
  purchases: [],
  inventories: [],
  returns: [],
});
export function useInventory(enabled: boolean) {
  const { user, can } = useAuth(),
    [data, setData] = useState<InventorySnapshot>(empty),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    epoch = useRef(0);
  const access = JSON.stringify([
    user?.id,
    user?.accessVersion,
    user?.permissions,
  ]);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const current = ++epoch.current;
    try {
      const keys = [
        ["stockLots", "lots"],
        ["purchases", "purchases"],
        ["stockInventories", "inventories"],
        ["purchaseReturns", "returns"],
      ] as const;
      const rows = await Promise.all(
        keys.map(async ([key, name]) => {
          if (!can(`${key}.read`)) return [name, []] as const;
          const response = await fetch(`/api/data/${key}`, {
            cache: "no-store",
          });
          if (!response.ok) {
            const body = await response.json();
            throw new Error(
              body.error ?? "Não foi possível atualizar o estoque",
            );
          }
          return [name, await response.json()] as const;
        }),
      );
      if (current === epoch.current) {
        setData(Object.fromEntries(rows) as InventorySnapshot);
        setError("");
      }
    } catch (e) {
      if (current === epoch.current) setError((e as Error).message);
    } finally {
      if (current === epoch.current) setLoading(false);
    }
  }, [enabled, can]);
  useEffect(() => {
    epoch.current++;
    setData(empty());
    setLoading(true);
    void refresh();
    const update = () => {
        void refresh();
      },
      timer = setInterval(() => {
        if (!document.hidden) update();
      }, 15000);
    window.addEventListener("erp:inventory-changed", update);
    window.addEventListener("erp:operation-completed", update);
    window.addEventListener("focus", update);
    // Access generation is not a DOM reference; invalidate responses on unmount.
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      epoch.current++;
      clearInterval(timer);
      window.removeEventListener("erp:inventory-changed", update);
      window.removeEventListener("erp:operation-completed", update);
      window.removeEventListener("focus", update);
    };
  }, [access, refresh]);
  return { data, error, loading, refresh };
}
