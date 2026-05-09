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
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { formatCurrency } from "@/lib/utils/price-calculations"

interface HourlySalesChartProps {
  data: Array<{
    hour: number
    revenue: number
    transactionCount: number
  }>
  enableAnimations?: boolean
}

const chartConfig = {
  revenue: {
    label: "Receita",
    color: "var(--chart-1)",
  },
  transactionCount: {
    label: "Transações",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function HourlySalesChart({ data, enableAnimations = true }: HourlySalesChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vendas por Hora do Dia</CardTitle>
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
        <CardTitle>Vendas por Hora do Dia</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart 
            data={data}
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(hour) => `${hour}h`}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => `${value}:00`}
                  formatter={(value, name) => {
                    if (name === "revenue") {
                      return [formatCurrency(value as number), "Receita"]
                    }
                    return [value, "Transações"]
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              dot={{ fill: "var(--color-revenue)", r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={enableAnimations}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
