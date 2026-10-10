"use client"
import type { ReactNode } from "react"
import { usePhoneLayout } from "@/hooks/use-phone-layout"

/** Keep desktop controls in place; collapse optional filters on phones. */
export function MobileFilters({ children, active = 0 }: { children: ReactNode; active?: number }) {
  const phone = usePhoneLayout()
  if (!phone) return <>{children}</>
  return <details className="mobile-filter-panel"><summary>Filtros{active > 0 ? ` · ${active} ativos` : ""}</summary><p className="mb-3 text-xs text-muted-foreground">Os filtros são aplicados ao selecionar.</p>{children}</details>
}
