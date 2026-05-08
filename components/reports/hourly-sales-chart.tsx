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
} from "recharts"
import { formatCurrency } from "@/lib/utils/price-calculations"

interface HourlySalesChartProps {
  data: Array<{
    hour: number
    revenue: number
    transactionCount: number
  }>
}

export function HourlySalesChart({ data }: HourlySalesChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas por Hora do Dia</CardTitle>
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
              dataKey="hour" 
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(hour) => `${hour}h`}
              stroke="hsl(var(--border))"
            />
            <YAxis 
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => formatCurrency(value)}
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
                if (name === 'revenue') return formatCurrency(value)
                return value
              }}
              labelFormatter={(hour) => `${hour}:00`}
              labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
            />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Receita"
              dot={{ fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
