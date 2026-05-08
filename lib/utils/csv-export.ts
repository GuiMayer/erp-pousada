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

  // Get headers from first object
  const headers = Object.keys(data[0])
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        // Escape values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
  ].join('\n')

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
}

export function exportDailySummaryToCSV(summary: any, date: string) {
  const data = [{
    Data: date,
    'Total Vendas': summary.totalSales,
    'Receita Total': summary.totalRevenue,
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
    'Percentual': c.percentage.toFixed(2) + '%',
  }))
  
  exportToCSV(data, `vendas-por-categoria-${date}`)
}
