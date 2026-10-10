"use client"
import type { ReactNode } from "react"
import { usePhoneLayout } from "@/hooks/use-phone-layout"

export function MobileSummary({ children, label }: { children: ReactNode; label: string }) {
  const phone = usePhoneLayout()
  return phone ? <details className="mobile-summary-toggle"><summary>{label}</summary><div className="pt-3">{children}</div></details> : <>{children}</>
}
