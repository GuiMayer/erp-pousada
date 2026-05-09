"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { PieChart, Pie, Cell } from "recharts"
import { formatCurrency } from "@/lib/utils/price-calculations"

interface PaymentMethodChartProps {
  data: Array<{
    method: string
    revenue: number
    count: number
    percentage: number
  }>
  enableAnimations?: boolean
}

const chartConfig = {
  Dinheiro: {
    label: "Dinheiro",
    color: "var(--chart-1)",
  },
  Débito: {
    label: "Débito",
    color: "var(--chart-2)",
  },
  Crédito: {
    label: "Crédito",
    color: "var(--chart-3)",
  },
  PIX: {
    label: "PIX",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

export function PaymentMethodChart({ data, enableAnimations = true }: PaymentMethodChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vendas por Forma de Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas por Forma de Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={100}
              dataKey="revenue"
              nameKey="method"
              isAnimationActive={enableAnimations}
            >
              {data.map((entry, index) => {
                const color = chartConfig[entry.method as keyof typeof chartConfig]?.color || "var(--chart-5)"
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={color}
                  />
                )
              })}
            </Pie>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    const item = data.find(d => d.method === name)
                    return [
                      <div key="tooltip" className="flex flex-col gap-1">
                        <span className="font-medium">{formatCurrency(value as number)}</span>
                        <span className="text-xs text-muted-foreground">
                          {item?.count} transações ({item?.percentage.toFixed(1)}%)
                        </span>
                      </div>,
                      name
                    ]
                  }}
                />
              }
            />
            <ChartLegend 
              content={<ChartLegendContent />}
              verticalAlign="bottom"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
