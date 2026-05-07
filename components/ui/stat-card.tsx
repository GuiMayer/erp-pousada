import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

type StatCardProps = {
  title: string
  value: string | number
  icon: LucideIcon
  variant?: "default" | "success" | "warning" | "destructive"
  description?: string
  className?: string
}

/**
 * Reusable stat card component for dashboard metrics
 */
export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = "default",
  description,
  className 
}: StatCardProps) {
  const variantClasses = {
    default: "border-border",
    success: "border-success/30 bg-success/5",
    warning: "border-warning/30 bg-warning/5",
    destructive: "border-destructive/30 bg-destructive/5",
  }

  const iconVariantClasses = {
    default: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }

  return (
    <Card className={cn(variantClasses[variant], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("size-4", iconVariantClasses[variant])} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
