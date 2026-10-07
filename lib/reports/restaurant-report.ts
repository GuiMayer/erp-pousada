/**
 * Restaurant Report Generator
 *
 * Generates PDF reports for restaurant orders with filtering options.
 */

import type { RestaurantOrder, POSProduct, ProductCategory, SystemSettings } from "../store"
import {
  createPDFDocument,
  generatePDFHeader,
  addTableToPDF,
  addPDFFooter,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "../utils/pdf-export"

export interface RestaurantReportFilters {
  startDate?: string
  endDate?: string
  status?: RestaurantOrder["status"] | "all"
  categoryId?: string | "all"
}

export interface RestaurantReportData {
  orders: RestaurantOrder[]
  products: POSProduct[]
  categories: ProductCategory[]
  filters: RestaurantReportFilters
}

/**
 * Gets the product name by ID
 */
function getProductName(productId: string, products: POSProduct[]): string {
  const product = products.find(p => p.id === productId)
  return product?.name || "Produto não encontrado"
}

/**
 * Gets the category name by ID
 */
function getCategoryName(categoryId: string, categories: ProductCategory[]): string {
  const category = categories.find(c => c.id === categoryId)
  return category?.name || "Sem categoria"
}

/**
 * Gets the status label in Portuguese
 */
function getStatusLabel(status: RestaurantOrder["status"]): string {
  const labels: Record<RestaurantOrder["status"], string> = {
    aberta: "Aberta",
    fechada: "Fechada",
    cancelada: "Cancelada",
  }
  return labels[status] || status
}

/**
 * Filters orders based on the provided criteria
 */
function filterOrders(
  orders: RestaurantOrder[],
  products: POSProduct[],
  filters: RestaurantReportFilters
): RestaurantOrder[] {
  return orders.filter(order => {
    // Filter by date range
    if (filters.startDate) {
      const orderDate = new Date(order.openedAt)
      const filterStart = new Date(filters.startDate)
      if (orderDate < filterStart) return false
    }

    if (filters.endDate) {
      const orderDate = new Date(order.openedAt)
      const filterEnd = new Date(filters.endDate)
      if (orderDate > filterEnd) return false
    }

    // Filter by status
    if (filters.status && filters.status !== "all") {
      if (order.status !== filters.status) return false
    }

    // Filter by category (check if any item in the order belongs to the category)
    if (filters.categoryId && filters.categoryId !== "all") {
      const hasProductInCategory = order.items.some(item => {
        const product = products.find(p => p.id === item.productId)
        return product?.categoryId === filters.categoryId
      })
      if (!hasProductInCategory) return false
    }

    return true
  })
}

/**
 * Generates a PDF report for restaurant orders
 *
 * @param data - Report data including orders, products, categories, and filters
 * @param systemSettings - System settings for header information
 * @returns Blob containing the PDF file
 */
export function generateRestaurantReport(
  data: RestaurantReportData,
  systemSettings: SystemSettings
): Blob {
  const doc = createPDFDocument()

  // Generate header
  let yPos = generatePDFHeader(doc, systemSettings, "Relatório de Restaurante")

  // Add filter information
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")

  const filterLines: string[] = []

  if (data.filters.startDate || data.filters.endDate) {
    const start = data.filters.startDate ? formatDate(data.filters.startDate) : "Início"
    const end = data.filters.endDate ? formatDate(data.filters.endDate) : "Fim"
    filterLines.push(`Período: ${start} até ${end}`)
  }

  if (data.filters.status && data.filters.status !== "all") {
    filterLines.push(`Status: ${getStatusLabel(data.filters.status)}`)
  }

  if (data.filters.categoryId && data.filters.categoryId !== "all") {
    const categoryName = getCategoryName(data.filters.categoryId, data.categories)
    filterLines.push(`Categoria: ${categoryName}`)
  }

  if (filterLines.length > 0) {
    doc.setTextColor(100, 100, 100)
    filterLines.forEach(line => {
      doc.text(line, 15, yPos)
      yPos += 5
    })
    yPos += 5
    doc.setTextColor(0, 0, 0)
  }

  // Filter orders
  const filteredOrders = filterOrders(data.orders, data.products, data.filters)

  // Sort by creation date (most recent first)
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
  })

  // Prepare table data
  const headers = ["Pedido", "Data/Hora", "Quarto", "Itens", "Status", "Total"]
  const rows = sortedOrders.map(order => {
    const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
    const itemsSummary = `${itemsCount} ${itemsCount === 1 ? "item" : "itens"}`

    return [
      `#${order.id}`,
      formatDateTime(order.openedAt),
      order.tableNumber || "N/A",
      itemsSummary,
      getStatusLabel(order.status),
      formatCurrency(order.total),
    ]
  })

  // Add table
  yPos = addTableToPDF(doc, headers, rows, yPos)

  // Add detailed items breakdown (optional, can be toggled)
  yPos += 5
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Produtos Vendidos", 15, yPos)
  yPos += 7

  // Aggregate products across all orders
  const productSales = new Map<string, { name: string; quantity: number; revenue: number }>()

  sortedOrders.forEach(order => {
    order.items.forEach(item => {
      const productName = getProductName(item.productId, data.products)
      const existing = productSales.get(item.productId) || { name: productName, quantity: 0, revenue: 0 }
      productSales.set(item.productId, {
        name: productName,
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + (item.quantity * item.unitPrice),
      })
    })
  })

  // Sort by revenue (highest first)
  const sortedProducts = Array.from(productSales.values()).sort((a, b) => b.revenue - a.revenue)

  const productHeaders = ["Produto", "Quantidade", "Receita"]
  const productRows = sortedProducts.map(product => [
    product.name,
    product.quantity.toString(),
    formatCurrency(product.revenue),
  ])

  yPos = addTableToPDF(doc, productHeaders, productRows, yPos)

  // Add summary statistics
  yPos += 5
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Resumo", 15, yPos)
  yPos += 7

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")

  const totalOrders = sortedOrders.length
  const totalRevenue = sortedOrders.reduce((sum, o) => sum + o.total, 0)
  const totalItems = sortedOrders.reduce((sum, o) =>
    sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  )

  const statusCounts: Record<string, number> = {}
  sortedOrders.forEach(o => {
    const label = getStatusLabel(o.status)
    statusCounts[label] = (statusCounts[label] || 0) + 1
  })

  doc.text(`Total de Pedidos: ${totalOrders}`, 15, yPos)
  yPos += 5
  doc.text(`Total de Itens Vendidos: ${totalItems}`, 15, yPos)
  yPos += 5
  doc.text(`Receita Total: ${formatCurrency(totalRevenue)}`, 15, yPos)
  yPos += 5

  if (totalOrders > 0) {
    doc.text(`Ticket Médio: ${formatCurrency(totalRevenue / totalOrders)}`, 15, yPos)
    yPos += 5
    doc.text(`Itens por Pedido (média): ${(totalItems / totalOrders).toFixed(1)}`, 15, yPos)
    yPos += 7

    doc.text("Distribuição por Status:", 15, yPos)
    yPos += 5

    Object.entries(statusCounts).forEach(([status, count]) => {
      const percentage = ((count / totalOrders) * 100).toFixed(1)
      doc.text(`  ${status}: ${count} (${percentage}%)`, 15, yPos)
      yPos += 5
    })
  }

  // Category breakdown
  if (data.categories.length > 0) {
    yPos += 2
    doc.text("Receita por Categoria:", 15, yPos)
    yPos += 5

    const categoryRevenue = new Map<string, number>()

    sortedOrders.forEach(order => {
      order.items.forEach(item => {
        const product = data.products.find(p => p.id === item.productId)
        if (product) {
          const categoryName = getCategoryName(product.categoryId, data.categories)
          const revenue = item.quantity * item.unitPrice
          categoryRevenue.set(categoryName, (categoryRevenue.get(categoryName) || 0) + revenue)
        }
      })
    })

    Array.from(categoryRevenue.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, revenue]) => {
        const percentage = totalRevenue > 0 ? ((revenue / totalRevenue) * 100).toFixed(1) : "0.0"
        doc.text(`  ${category}: ${formatCurrency(revenue)} (${percentage}%)`, 15, yPos)
        yPos += 5
      })
  }

  // Add footer
  addPDFFooter(doc)

  // Generate blob
  const pdfBlob = doc.output("blob")
  return pdfBlob
}

/**
 * Downloads the restaurant report as a PDF file
 *
 * @param data - Report data
 * @param systemSettings - System settings
 * @param filename - Optional custom filename (without extension)
 */
export function downloadRestaurantReport(
  data: RestaurantReportData,
  systemSettings: SystemSettings,
  filename?: string
): void {
  const blob = generateRestaurantReport(data, systemSettings)

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split("T")[0]
  const defaultFilename = `relatorio-restaurante-${timestamp}.pdf`
  const finalFilename = filename ? `${filename}.pdf` : defaultFilename

  // Create download link
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = finalFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
