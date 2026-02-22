"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, BedDouble, Wrench, LayoutGrid } from "lucide-react"
import type { RoomStatus } from "@/lib/room-data"

type Filter = RoomStatus | "todos"

const filters: { value: Filter; label: string; icon: React.ReactNode }[] = [
  { value: "todos", label: "Todos", icon: <LayoutGrid className="size-3.5" /> },
  { value: "livre", label: "Livres", icon: <CheckCircle2 className="size-3.5" /> },
  { value: "ocupado", label: "Ocupados", icon: <BedDouble className="size-3.5" /> },
  { value: "manutencao", label: "Manut.", icon: <Wrench className="size-3.5" /> },
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
