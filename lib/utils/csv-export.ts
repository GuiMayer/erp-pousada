import { formatCurrency, formatNumber, formatPercent } from "./formatters"
/**
 * CSV Export Utilities
 * 
 * Functions to export data to CSV format
 */

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    console.warn('No data to export')
    return
  }

  const headers = Object.keys(data[0])
  const cell = (value: unknown) => {
    let text = typeof value === "number" ? formatNumber(value, Math.min(12, (String(value).split(".")[1] ?? "").length), false) : String(value ?? "")
    if (typeof value !== "number" && /^[\s]*[=+@-]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }
  const csvContent = "\uFEFF" + [headers.map(cell).join(";"), ...data.map(row => headers.map(header => cell(row[header])).join(";"))].join("\r\n")

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportDailySummaryToCSV(summary: any, date: string) {
  const data = [{
    Data: date,
    'Total Vendas': summary.totalSales,
    'Vendas de bebidas': summary.totalRevenue,
    'Ticket Médio': summary.averageTicket,
    'Transações': summary.transactionCount,
    'Dinheiro': summary.cashRevenue,
    'Débito': summary.debitRevenue,
    'Crédito': summary.creditRevenue,
    'PIX': summary.pixRevenue,
  }]
  
  exportToCSV(data, `relatorio-diario-${date}`)
}

export function exportTopProductsToCSV(products: any[], date: string) {
  const data = products.map((p, index) => ({
    'Posição': index + 1,
    'Produto': p.productName,
    'Categoria': p.category,
    'Quantidade': p.quantity,
    'Receita': p.revenue,
    'Preço Médio': p.averagePrice,
  }))
  
  exportToCSV(data, `top-produtos-${date}`)
}

export function exportSalesByCategoryToCSV(categories: any[], date: string) {
  const data = categories.map(c => ({
    'Categoria': c.category,
    'Receita': c.revenue,
    'Quantidade': c.quantity,
    'Percentual': formatPercent(c.percentage, 2),
  }))
  
  exportToCSV(data, `vendas-por-categoria-${date}`)
}

export function exportPaymentMethodToCSV(methods: any[], date: string) {
  const data = methods.map(m => ({
    'Forma de Pagamento': m.method,
    'Receita': m.revenue,
    'Quantidade': m.count,
    'Percentual': formatPercent(m.percentage, 2),
  }))
  
  exportToCSV(data, `formas-pagamento-${date}`)
}

export function exportRevenueTrendToCSV(trend: any[], dateRange: string) {
  const data = trend.map(t => ({
    'Data': new Date(t.date).toLocaleDateString('pt-BR'),
    'Receita': t.revenue,
    'Transações': t.transactionCount,
  }))
  
  exportToCSV(data, `tendencia-receita-${dateRange}`)
}

export function exportStockAlertsToCSV(alerts: any[]) {
  const data = alerts.map(a => ({
    'Produto': a.productName,
    'Estoque Atual': a.currentStock,
    'Estoque Mínimo': a.minimumStock,
    'Unidade': a.unit,
    'Status': a.status === 'critical' ? 'Crítico' : 'Baixo',
  }))
  
  exportToCSV(data, `alertas-estoque-${new Date().toISOString().split('T')[0]}`)
}

export function exportCompleteReport(
  summary: any,
  categories: any[],
  methods: any[],
  topProducts: any[],
  dateLabel: string
) {
  // Create a comprehensive report with all data
  const reportData = [
    { Seção: 'RESUMO GERAL', Valor: '' },
    { Seção: 'Data', Valor: summary.date },
    { Seção: 'Total de Vendas', Valor: summary.totalSales },
    { Seção: 'Vendas de bebidas', Valor: summary.totalRevenue },
    { Seção: 'Ticket Médio', Valor: summary.averageTicket },
    { Seção: 'Transações', Valor: summary.transactionCount },
    { Seção: '', Valor: '' },
    { Seção: 'FORMAS DE PAGAMENTO', Valor: '' },
    { Seção: 'Dinheiro', Valor: summary.cashRevenue },
    { Seção: 'Débito', Valor: summary.debitRevenue },
    { Seção: 'Crédito', Valor: summary.creditRevenue },
    { Seção: 'PIX', Valor: summary.pixRevenue },
    { Seção: '', Valor: '' },
    { Seção: 'TOP 5 CATEGORIAS', Valor: '' },
    ...categories.slice(0, 5).map(c => ({
      Seção: c.category,
      Valor: `${formatCurrency(c.revenue)} (${formatPercent(c.percentage)})`,
    })),
    { Seção: '', Valor: '' },
    { Seção: 'TOP 5 PRODUTOS', Valor: '' },
    ...topProducts.slice(0, 5).map((p, i) => ({
      Seção: `${i + 1}. ${p.productName}`,
      Valor: `${p.quantity} un - ${formatCurrency(p.revenue)}`,
    })),
  ]
  
  exportToCSV(reportData, `relatorio-completo-${dateLabel}`)
}

