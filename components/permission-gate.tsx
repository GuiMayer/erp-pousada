"use client"
import type { ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
export function PermissionGate({ permission, children, approval = false }: { permission: string | string[]; children: ReactNode; approval?: boolean }) {
  const { can, canRequest } = useAuth()
  const allowed = approval ? canRequest : can
  return (Array.isArray(permission) ? permission.some(allowed) : allowed(permission)) ? children : null
}
