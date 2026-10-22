"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { PieChart, Pie, Cell } from "recharts"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { paymentChartData, paymentPresentation } from "@/lib/reports/payment-presentation"
interface PaymentMethodChartProps {
  data: { method: string; revenue: number; count: number; percentage: number }[]
  enableAnimations?: boolean
}
export function PaymentMethodChart({ data, enableAnimations = true }: PaymentMethodChartProps) {
  const values = paymentChartData(data ?? [])
  const positive = values.filter(item => item.revenue > 0)
  const legend = values.filter(item => !["stay", "other"].includes(item.id) || item.count > 0 || item.revenue > 0)
  return <Card className="min-w-0"><CardHeader><CardTitle>Vendas por forma de cobrança</CardTitle></CardHeader><CardContent>
    {positive.length ? <ChartContainer config={paymentPresentation} className="aspect-auto h-60 w-full" role="img" aria-label="Distribuição das vendas; valores por forma de cobrança na legenda abaixo">
      <PieChart margin={{top:12,right:12,bottom:12,left:12}}>
        <Pie data={positive} cx="50%" cy="50%" outerRadius="80%" dataKey="revenue" nameKey="label" isAnimationActive={enableAnimations}>
          {positive.map(item => <Cell key={item.id} fill={item.color} />)}
        </Pie>
        <ChartTooltip content={({ active, payload }) => {
          const item = payload?.[0]?.payload as typeof values[number] | undefined
          return active && item ? <div className="rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md"><p className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{background:item.color}} />{item.label}</p><p>{formatCurrency(item.revenue)} · {formatPercent(item.percentage)}</p><p>{item.count} transações</p></div> : null
        }} />
      </PieChart>
    </ChartContainer> : <p role="status" className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda no período</p>}
    <ul className="grid gap-2 text-sm sm:grid-cols-2" aria-label="Valores por forma de cobrança">{legend.map(item => <li key={item.id} className="flex min-w-0 items-start gap-2"><span aria-hidden className="mt-1 size-3 shrink-0 rounded-sm" style={{background:item.color}} /><span>{item.label}<span className="block text-muted-foreground">{formatCurrency(item.revenue)} · {formatPercent(item.percentage)}</span></span></li>)}</ul>
  </CardContent></Card>
}
