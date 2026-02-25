"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, BedDouble, SprayCan, Lock, LayoutGrid } from "lucide-react"
import type { RoomStatus } from "@/lib/store"

type Filter = RoomStatus | "todos"

const filters: { value: Filter; label: string; icon: React.ReactNode }[] = [
  { value: "todos", label: "Todos", icon: <LayoutGrid className="size-3.5" /> },
  { value: "disponivel", label: "Disponivel", icon: <CheckCircle2 className="size-3.5" /> },
  { value: "ocupado", label: "Ocupados", icon: <BedDouble className="size-3.5" /> },
  { value: "limpeza", label: "Limpeza", icon: <SprayCan className="size-3.5" /> },
  { value: "bloqueado", label: "Bloqueado", icon: <Lock className="size-3.5" /> },
]

export function RoomFilters({
  active,
  onChange,
}: {
  active: Filter
  onChange: (f: Filter) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((f) => (
        <Button
          key={f.value}
          variant={active === f.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(f.value)}
          className="gap-1.5 text-xs"
        >
          {f.icon}
          {f.label}
        </Button>
      ))}
    </div>
  )
}

export type { Filter }
