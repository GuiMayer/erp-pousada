"use client"
import { DateField } from "@/components/ui/date-field"
import { SectionTabs } from "../section-tabs"
import { useState, type ReactNode } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { buildLodgingReport } from "@/lib/reports/lodging"
import { reportAccess, reportQuery, reportCSV } from "@/lib/reports/management"
import { businessDay } from "@/lib/utils/business-values"
import { formatCurrency } from "@/lib/utils/formatters"
import { Button } from "../ui/button"
import { Label } from "../ui/label"
import { MetricCard } from "./metric-card"

export function DemoManagementReports({ beverages }: { beverages: ReactNode }) {
  const { stays = [], rooms = [], reservations = [], transactions = [] } = useApp()
  const { can } = useAuth()
  const sections = [
    { key: "hospedagem", label: "Hospedagem", available: reportAccess.hospedagem.every(can) },
    { key: "bebidas", label: "Bebidas", available: reportAccess.bebidas.every(can) },
    { key: "recebimentos", label: "Recebimentos", available: can("transactions.read") },
  ].filter(s => s.available)
  const [section, setSection] = useState(sections[0]?.key), [start, setStart] = useState(businessDay().slice(0, 7) + "-01"), [end, setEnd] = useState(businessDay())
  const current = sections.some(s => s.key === section) ? section : sections[0]?.key
  const parsed = reportQuery.safeParse({ section: "hospedagem", start, end })
  const report = parsed.success ? buildLodgingReport(parsed.data, new Date(), stays, rooms.length, reservations) : null
  const entries = transactions.filter(t => businessDay(t.date) >= start && businessDay(t.date) <= end)
  const incoming = entries.filter(t => t.type === "receita").reduce((sum, t) => sum + Math.round(t.value * 100), 0) / 100
  const refunds = entries.filter(t => t.type === "estorno").reduce((sum, t) => sum + Math.round(Math.abs(t.value) * 100), 0) / 100
  function exportReport() {
    if (!report || !can("reports.export")) return
    const url = URL.createObjectURL(new Blob([reportCSV(report)], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `hospedagem-${start}-${end}.csv`; anchor.click(); URL.revokeObjectURL(url)
  }
  return <div className="space-y-4">
    <SectionTabs label="Indicadores da pousada" sections={sections} value={current} onValueChange={setSection}>
    {!current && <p>Nenhum indicador foi liberado para seu usuário.</p>}
    {current === "bebidas" ? beverages : current && <>
      <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 space-y-2"><Label htmlFor="demo-report-start">Início</Label><DateField aria-label="Início" id="demo-report-start"  value={start} onValueChange={value => setStart(value)} /></div><div className="min-w-0 space-y-2"><Label htmlFor="demo-report-end">Fim</Label><DateField aria-label="Fim" id="demo-report-end"  value={end} onValueChange={value => setEnd(value)} /></div>{current === "hospedagem" && can("reports.export") && <Button variant="outline" disabled={!report} onClick={exportReport}>Exportar hospedagem</Button>}</div>
      {!report ? <p role="alert">Informe um período válido de até 366 dias.</p> : current === "hospedagem" ? <>
        <h2 className="text-xl font-semibold">Hospedagem</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{report.metrics.map(metric => <MetricCard key={metric.key} title={metric.label} value={metric.value} format={metric.unit === "money" ? "currency" : metric.unit === "percent" ? "percentage" : "number"} />)}</div>
        <p className="text-sm text-muted-foreground">Diárias prestadas medem o serviço realizado. Sinais e recebimentos de dívidas aparecem em Recebimentos e não aumentam a ocupação ou a diária média.</p>
        <details className="rounded-lg border p-3"><summary className="cursor-pointer">Critérios e diárias do período</summary><ul className="my-3 list-disc space-y-1 pl-5 text-sm">{report.criteria.map(c => <li key={c}>{c}</li>)}</ul><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Dia</th><th className="text-left">Hóspede</th><th className="text-left">Situação</th><th className="text-right">Valor</th></tr></thead><tbody>{report.rows.slice(0, 100).map(row => <tr key={row.id}><td>{row.date.split("-").reverse().join("/")}</td><td>{row.label}</td><td>{row.kind === "diaria-prestada" ? "Prestada" : "Acordada"}</td><td className="text-right">{formatCurrency(row.value ?? 0)}</td></tr>)}</tbody></table></div>{report.rows.length > 100 && <p className="text-sm">Exibindo 100 diárias. A exportação contém o período completo.</p>}{report.warnings.map(w => <p key={w} className="text-sm">{w}</p>)}</details>
      </> : <>
        <h2 className="text-xl font-semibold">Recebimentos financeiros</h2><div className="grid gap-3 sm:grid-cols-3"><MetricCard title="Recebimentos brutos" value={incoming} format="currency" /><MetricCard title="Devoluções" value={refunds} format="currency" /><MetricCard title="Recebimentos líquidos" value={incoming - refunds} format="currency" /></div>
        <p className="text-sm text-muted-foreground">Inclui sinais, diárias e bebidas efetivamente recebidos no período. Não inclui valores apenas lançados na hospedagem, fundos de caixa, suprimentos ou transferências.</p>
      </>}
    </>}
  </SectionTabs></div>
}
