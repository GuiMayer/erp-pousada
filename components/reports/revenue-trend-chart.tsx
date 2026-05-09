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

interface RevenueTrendChartProps {
  data: Array<{
    date: string
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

export function RevenueTrendChart({ data, enableAnimations = true }: RevenueTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tendência de Receita</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[350px]">
          <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    )
  }

  // Format data for display
  const formattedData = data.map(item => ({
    ...item,
    displayDate: new Date(item.date).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    }),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendência de Receita</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart 
            data={formattedData}
            margin={{ top: 20, right: 60, bottom: 20, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="displayDate"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value, payload) => {
                    if (payload && payload[0]) {
                      const date = new Date(payload[0].payload.date)
                      return date.toLocaleDateString('pt-BR', { 
                        day: '2-digit', 
                        month: 'long',
                        year: 'numeric'
                      })
                    }
                    return value
                  }}
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
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              dot={{ fill: "var(--color-revenue)", r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={enableAnimations}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="transactionCount"
              stroke="var(--color-transactionCount)"
              strokeWidth={2}
              dot={{ fill: "var(--color-transactionCount)", r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={enableAnimations}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
