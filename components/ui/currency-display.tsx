import { formatCurrency } from "@/lib/utils/formatters"
import { cn } from "@/lib/utils"

type CurrencyDisplayProps = {
  value: number
  className?: string
  variant?: "default" | "positive" | "negative"
  size?: "sm" | "md" | "lg"
}

/**
 * Reusable currency display component with formatting
 */
export function CurrencyDisplay({ 
  value, 
  className,
  variant = "default",
  size = "md" 
}: CurrencyDisplayProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg font-semibold",
  }

  const variantClasses = {
    default: "",
    positive: "text-success",
    negative: "text-destructive",
  }

  return (
    <span className={cn(
      sizeClasses[size],
      variantClasses[variant],
      className
    )}>
      {formatCurrency(value)}
    </span>
  )
}
