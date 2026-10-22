"use client"
import { BedDouble, CheckCircle2, Users, SprayCan, Lock } from "lucide-react"
import type { Room } from "@/lib/store"
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

export function RoomSummary({ rooms }: { rooms: Room[] }) {
  const counts = countStatuses(rooms)
  return <section aria-label="Resumo de quartos" className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
    <StatPill label="Total" value={counts.total} icon={<BedDouble className="size-4" />} variant="default" />
    <StatPill label="Disponíveis" value={counts.disponivel} icon={<CheckCircle2 className="size-4" />} variant="success" />
    <StatPill label="Ocupados" value={counts.ocupado} icon={<Users className="size-4" />} variant="warning" />
    <StatPill label="Limpeza" value={counts.limpeza} icon={<SprayCan className="size-4" />} variant="cleaning" />
    <StatPill label="Bloqueados" value={counts.bloqueado} icon={<Lock className="size-4" />} variant="info" />
  </section>
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
