"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { formatCurrency } from "@/lib/utils/price-calculations"

interface RevenueTrendChartProps {
  data: Array<{
    date: string
    revenue: number
    transactionCount: number
  }>
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendência de Receita</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
            <XAxis 
              dataKey="date" 
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              tickFormatter={(date) => {
                const d = new Date(date)
                return `${d.getDate()}/${d.getMonth() + 1}`
              }}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => formatCurrency(value)}
              stroke="hsl(var(--border))"
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                color: 'hsl(var(--popover-foreground))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'Receita') return formatCurrency(value)
                return value
              }}
              labelFormatter={(date) => {
                const d = new Date(date)
                return d.toLocaleDateString('pt-BR')
              }}
              labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
            />
            <Legend 
              wrapperStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="revenue" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Receita"
              dot={{ fill: 'hsl(var(--primary))' }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="transactionCount" 
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2}
              name="Transações"
              dot={{ fill: 'hsl(var(--chart-2))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
