"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { formatCurrency } from "@/lib/utils/price-calculations"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    label: string
  }
  icon?: React.ReactNode
  format?: 'currency' | 'number' | 'percentage'
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend,
  icon,
  format = 'number'
}: MetricCardProps) {
  const formattedValue = format === 'currency' 
    ? formatCurrency(Number(value))
    : format === 'percentage'
    ? `${Number(value).toFixed(1)}%`
    : value

  const getTrendIcon = () => {
    if (!trend) return null
    if (trend.value > 0) return <TrendingUp className="h-4 w-4 text-success" />
    if (trend.value < 0) return <TrendingDown className="h-4 w-4 text-destructive" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  const getTrendColor = () => {
    if (!trend) return ''
    if (trend.value > 0) return 'text-success'
    if (trend.value < 0) return 'text-destructive'
    return 'text-muted-foreground'
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {getTrendIcon()}
            <span className={cn("text-xs font-medium", getTrendColor())}>
              {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
