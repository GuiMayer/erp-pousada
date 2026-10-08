"use client"

import { BedDouble, CheckCircle2, Users, SprayCan, Lock, LogOut, UserCheck, UserX, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PROFILES } from "@/lib/permissions"
import { useAuth } from "@/lib/auth-context"
import { useApp } from "@/lib/app-context"
import { useUserPreferences } from "@/contexts/user-preferences-context"
import { NotificationCenter } from "@/components/notification-center"
import type { Room, RoomStatus } from "@/lib/store"

type StatusCount = {
  total: number
  disponivel: number
  ocupado: number
  limpeza: number
  bloqueado: number
}

function countStatuses(rooms: Room[]): StatusCount {
  return rooms.reduce(
    (acc, room) => {
      acc.total++
      acc[room.status]++
      return acc
    },
    { total: 0, disponivel: 0, ocupado: 0, limpeza: 0, bloqueado: 0 }
  )
}

export function DashboardHeader({ rooms }: { rooms: Room[] }) {
  const counts = countStatuses(rooms)
  const { user, username, role, logout, can } = useAuth()
  const { systemSettings, customers, accountsReceivable } = useApp()
  const { preferences } = useUserPreferences()
  const today = new Date()
  const formatted = today.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  // Customer metrics (commented out - kept for future reuse)
  // const totalCustomers = customers.length
  // const activeCustomers = customers.filter(c => c.active).length
  // const customersWithPendingAccounts = new Set(
  //   accountsReceivable
  //     .filter(ar => ar.status === "pendente" || ar.status === "vencido")
  //     .map(ar => ar.customerId)
  // ).size

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

      {/* Room Metrics - Can be hidden via settings */}
      {can("rooms.read") && preferences.showRoomMetrics && (
        <div className="flex flex-wrap gap-2 sm:grid sm:grid-cols-5 sm:gap-3">
          <StatPill label="Total" value={counts.total} icon={<BedDouble className="size-4" />} variant="default" />
          <StatPill label="Disponivel" value={counts.disponivel} icon={<CheckCircle2 className="size-4" />} variant="success" />
          <StatPill label="Ocupados" value={counts.ocupado} icon={<Users className="size-4" />} variant="warning" />
          <StatPill label="Limpeza" value={counts.limpeza} icon={<SprayCan className="size-4" />} variant="cleaning" />
          <StatPill label="Bloqueado" value={counts.bloqueado} icon={<Lock className="size-4" />} variant="info" />
        </div>
      )}

      {/* Customer Metrics Section - Removed to reduce visual clutter */}
      {/* Uncomment below to restore customer metrics display */}
      {/* <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatPill 
          label="Total de Clientes" 
          value={totalCustomers} 
          icon={<Users className="size-4" />} 
          variant="default" 
        />
        <StatPill 
          label="Clientes Ativos" 
          value={activeCustomers} 
          icon={<UserCheck className="size-4" />} 
          variant="success" 
        />
        <StatPill 
          label="Com Contas Pendentes" 
          value={customersWithPendingAccounts} 
          icon={<AlertCircle className="size-4" />} 
          variant="warning" 
        />
      </div> */}
    </header>
  )
}

function StatPill({
  label,
  value,
  icon,
  variant,
}: {
  label: string
  value: number
  icon: React.ReactNode
  variant: "default" | "success" | "warning" | "cleaning" | "info"
}) {
  const styles = {
    default: "bg-secondary text-secondary-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    cleaning: "bg-cleaning/10 text-cleaning",
    info: "bg-info/10 text-info",
  }

  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 sm:gap-2.5 sm:rounded-xl sm:px-4 sm:py-3 ${styles[variant]}`}>
      {icon}
      <div className="flex items-baseline gap-1.5">
        <span className="text-base font-bold tabular-nums sm:text-xl">{value}</span>
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
    </div>
  )
}
