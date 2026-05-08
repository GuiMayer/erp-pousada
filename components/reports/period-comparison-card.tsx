"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { formatCurrency } from "@/lib/utils/price-calculations"
import { cn } from "@/lib/utils"

interface PeriodComparisonCardProps {
  currentPeriod: {
    label: string
    revenue: number
    transactions: number
    averageTicket: number
  }
  previousPeriod: {
    label: string
    revenue: number
    transactions: number
    averageTicket: number
  }
}

export function PeriodComparisonCard({ currentPeriod, previousPeriod }: PeriodComparisonCardProps) {
  const revenueChange = previousPeriod.revenue > 0
    ? ((currentPeriod.revenue - previousPeriod.revenue) / previousPeriod.revenue) * 100
    : 0

  const transactionsChange = previousPeriod.transactions > 0
    ? ((currentPeriod.transactions - previousPeriod.transactions) / previousPeriod.transactions) * 100
    : 0

  const ticketChange = previousPeriod.averageTicket > 0
    ? ((currentPeriod.averageTicket - previousPeriod.averageTicket) / previousPeriod.averageTicket) * 100
    : 0

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-success" />
    if (change < 0) return <TrendingDown className="h-4 w-4 text-destructive" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-success'
    if (change < 0) return 'text-destructive'
    return 'text-muted-foreground'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparação de Períodos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Revenue Comparison */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Receita</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(revenueChange)}
                <span className={cn("text-sm font-medium", getTrendColor(revenueChange))}>
                  {revenueChange > 0 ? '+' : ''}{revenueChange.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{currentPeriod.label}</p>
                <p className="text-lg font-bold">{formatCurrency(currentPeriod.revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{previousPeriod.label}</p>
                <p className="text-lg font-medium text-muted-foreground">
                  {formatCurrency(previousPeriod.revenue)}
                </p>
              </div>
            </div>
          </div>

          {/* Transactions Comparison */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Transações</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(transactionsChange)}
                <span className={cn("text-sm font-medium", getTrendColor(transactionsChange))}>
                  {transactionsChange > 0 ? '+' : ''}{transactionsChange.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{currentPeriod.label}</p>
                <p className="text-lg font-bold">{currentPeriod.transactions}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{previousPeriod.label}</p>
                <p className="text-lg font-medium text-muted-foreground">
                  {previousPeriod.transactions}
                </p>
              </div>
            </div>
          </div>

          {/* Average Ticket Comparison */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Ticket Médio</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(ticketChange)}
                <span className={cn("text-sm font-medium", getTrendColor(ticketChange))}>
                  {ticketChange > 0 ? '+' : ''}{ticketChange.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{currentPeriod.label}</p>
                <p className="text-lg font-bold">{formatCurrency(currentPeriod.averageTicket)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{previousPeriod.label}</p>
                <p className="text-lg font-medium text-muted-foreground">
                  {formatCurrency(previousPeriod.averageTicket)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
