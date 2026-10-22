"use client"

import { BedDouble, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PROFILES } from "@/lib/permissions"
import { useAuth } from "@/lib/auth-context"
import { useApp } from "@/lib/app-context"
import { NotificationCenter } from "@/components/notification-center"

export function DashboardHeader() {
  const { user, username, role, logout } = useAuth()
  const { systemSettings } = useApp()
  const today = new Date()
  const formatted = today.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <header className="flex flex-col gap-3 sm:gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary sm:size-10">
              <BedDouble className="size-5 text-primary-foreground" />
            </div>
            <h1 className="min-w-0 break-words text-lg font-bold tracking-tight text-foreground sm:text-2xl">
              {systemSettings.pousadaName}
            </h1>
          </div>
          <p className="hidden mt-1.5 text-sm capitalize text-muted-foreground sm:block">
            {formatted}
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          <NotificationCenter />
          <div className="min-w-0 flex-1 truncate rounded-lg bg-secondary px-2 py-1.5 text-xs sm:flex-none sm:px-3">
            <span className="hidden text-muted-foreground sm:inline">Logado como </span>
            <span className="font-semibold capitalize text-foreground">{username}</span>
            <span className="hidden ml-1 text-muted-foreground sm:inline">({PROFILES[user?.accessProfile ?? ""]?.label ?? role})</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-xs text-muted-foreground">
            <LogOut className="size-3.5" />
            Sair
          </Button>
        </div>
      </div>

    </header>
  )
}
