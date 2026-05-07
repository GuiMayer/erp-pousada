import { Badge } from "@/components/ui/badge"
import { 
  DoorOpen, BedDouble, SprayCan, Lock,
  CheckCircle2, Clock, XCircle, AlertTriangle 
} from "lucide-react"
import type { RoomStatus, ReservationStatus } from "@/lib/store"

type RoomStatusConfig = {
  label: string
  variant: "default" | "success" | "warning" | "destructive" | "secondary"
  icon: React.ReactNode
}

const roomStatusConfig: Record<RoomStatus, RoomStatusConfig> = {
  disponivel: {
    label: "Disponível",
    variant: "success",
    icon: <DoorOpen className="size-3.5" />,
  },
  ocupado: {
    label: "Ocupado",
    variant: "warning",
    icon: <BedDouble className="size-3.5" />,
  },
  limpeza: {
    label: "Limpeza",
    variant: "secondary",
    icon: <SprayCan className="size-3.5" />,
  },
  bloqueado: {
    label: "Bloqueado",
    variant: "default",
    icon: <Lock className="size-3.5" />,
  },
}

const reservationStatusConfig: Record<ReservationStatus, RoomStatusConfig> = {
  confirmada: {
    label: "Confirmada",
    variant: "default",
    icon: <Clock className="size-3.5" />,
  },
  checkin: {
    label: "Check-in",
    variant: "success",
    icon: <CheckCircle2 className="size-3.5" />,
  },
  checkout: {
    label: "Check-out",
    variant: "secondary",
    icon: <CheckCircle2 className="size-3.5" />,
  },
  cancelada: {
    label: "Cancelada",
    variant: "destructive",
    icon: <XCircle className="size-3.5" />,
  },
  noshow: {
    label: "No-show",
    variant: "destructive",
    icon: <AlertTriangle className="size-3.5" />,
  },
}

type StatusBadgeProps = {
  status: RoomStatus | ReservationStatus
  type: "room" | "reservation"
  className?: string
}

/**
 * Reusable status badge component for rooms and reservations
 */
export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const config = type === "room" 
    ? roomStatusConfig[status as RoomStatus]
    : reservationStatusConfig[status as ReservationStatus]

  if (!config) return null

  return (
    <Badge variant={config.variant} className={className}>
      {config.icon}
      <span className="ml-1">{config.label}</span>
    </Badge>
  )
}
