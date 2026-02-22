"use client"

import { BedDouble, CheckCircle2, AlertTriangle, Wrench } from "lucide-react"
import type { Room } from "@/lib/room-data"

type StatusCount = {
  total: number
  livre: number
  ocupado: number
  manutencao: number
}

function countStatuses(rooms: Room[]): StatusCount {
  return rooms.reduce(
    (acc, room) => {
      acc.total++
      acc[room.status]++
      return acc
    },
    { total: 0, livre: 0, ocupado: 0, manutencao: 0 }
  )
}

export function DashboardHeader({ rooms }: { rooms: Room[] }) {
  const counts = countStatuses(rooms)
  const today = new Date()
  const formatted = today.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <header className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
              <BedDouble className="size-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Pousada Sol & Mar
            </h1>
          </div>
          <p className="mt-1.5 text-sm capitalize text-muted-foreground">
            {formatted}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill
          label="Total"
          value={counts.total}
          icon={<BedDouble className="size-4" />}
          variant="default"
        />
        <StatPill
          label="Livres"
          value={counts.livre}
          icon={<CheckCircle2 className="size-4" />}
          variant="success"
        />
        <StatPill
          label="Ocupados"
          value={counts.ocupado}
          icon={<AlertTriangle className="size-4" />}
          variant="warning"
        />
        <StatPill
          label="Manut."
          value={counts.manutencao}
          icon={<Wrench className="size-4" />}
          variant="destructive"
        />
      </div>
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
  variant: "default" | "success" | "warning" | "destructive"
}) {
  const styles = {
    default: "bg-secondary text-secondary-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
  }

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-4 py-3 ${styles[variant]}`}
    >
      {icon}
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold tabular-nums">{value}</span>
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
    </div>
  )
}
