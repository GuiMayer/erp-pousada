import { formatDateBR, formatDateTime, daysUntilDue } from "@/lib/utils/formatters"
import { cn } from "@/lib/utils"
import { Calendar, Clock, AlertTriangle } from "lucide-react"

type DateDisplayProps = {
  date: string
  format?: "short" | "full"
  showIcon?: boolean
  className?: string
}

/**
 * Reusable date display component with formatting
 */
export function DateDisplay({ 
  date, 
  format = "short",
  showIcon = false,
  className 
}: DateDisplayProps) {
  const formatted = format === "short" ? formatDateBR(date) : formatDateTime(date)
  const Icon = format === "short" ? Calendar : Clock

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {showIcon && <Icon className="size-3.5" />}
      {formatted}
    </span>
  )
}

type DueDateDisplayProps = {
  dueDate: string
  className?: string
  showDaysRemaining?: boolean
}

/**
 * Due date display with overdue warning
 */
export function DueDateDisplay({ 
  dueDate, 
  className,
  showDaysRemaining = true 
}: DueDateDisplayProps) {
  const days = daysUntilDue(dueDate)
  const isOverdue = days < 0
  const isDueSoon = days >= 0 && days <= 3

  return (
    <span className={cn(
      "inline-flex items-center gap-1",
      isOverdue && "text-destructive",
      isDueSoon && "text-warning",
      className
    )}>
      {isOverdue && <AlertTriangle className="size-3.5" />}
      <Calendar className="size-3.5" />
      {formatDateBR(dueDate)}
      {showDaysRemaining && (
        <span className="text-xs">
          ({days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `${Math.abs(days)}d`})
        </span>
      )}
    </span>
  )
}
