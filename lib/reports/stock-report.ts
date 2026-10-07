/**
 * Stock Report Generator
 *
 * Generates PDF reports for stock/inventory with filtering options.
 */

import type { ProductCategory, SystemSettings } from "../store"
import {
  createPDFDocument,
  generatePDFHeader,
  addTableToPDF,
  addPDFFooter,
  formatCurrency,
} from "../utils/pdf-export"

export type StockReportProduct = { id: string; name: string; categoryId: string; type: "consumable" | "sellable"; currentStock: number; minimumStock: number; unitPrice: number }

export interface StockReportFilters {
  categoryId?: string | "all"
  lowStock?: boolean // Show only products below minimum stock
  type?: StockReportProduct["type"] | "all"
}

export interface StockReportData {
  products: StockReportProduct[]
  categories: ProductCategory[]
  filters: StockReportFilters
}

/**
 * Gets the category name by ID
 */
function getCategoryName(categoryId: string, categories: ProductCategory[]): string {
  const category = categories.find(c => c.id === categoryId)
  return category?.name || "Sem categoria"
}

/**
 * Gets the product type label in Portuguese
 */
function getTypeLabel(type: StockReportProduct["type"]): string {
  const labels: Record<StockReportProduct["type"], string> = {
    consumable: "Consumível",
    sellable: "Vendável",
  }
  return labels[type] || type
}

/**
 * Filters products based on the provided criteria
 */
function filterProducts(
  products: StockReportProduct[],
  filters: StockReportFilters
): StockReportProduct[] {
  return products.filter(product => {
    // Filter by category
    if (filters.categoryId && filters.categoryId !== "all") {
      if (product.categoryId !== filters.categoryId) return false
    }

    // Filter by low stock
    if (filters.lowStock) {
      if (product.currentStock >= product.minimumStock) return false
    }

    // Filter by type
    if (filters.type && filters.type !== "all") {
      if (product.type !== filters.type) return false
    }

    return true
  })
}

/**
 * Generates a PDF report for stock/inventory
 *
 * @param data - Report data including products, categories, and filters
 * @param systemSettings - System settings for header information
 * @returns Blob containing the PDF file
 */
export function generateStockReport(
  data: StockReportData,
  systemSettings: SystemSettings
): Blob {
  const doc = createPDFDocument()

  // Generate header
  let yPos = generatePDFHeader(doc, systemSettings, "Relatório de Estoque")

  // Add filter information
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")

  const filterLines: string[] = []

  if (data.filters.categoryId && data.filters.categoryId !== "all") {
    const categoryName = getCategoryName(data.filters.categoryId, data.categories)
    filterLines.push(`Categoria: ${categoryName}`)
  }

  if (data.filters.type && data.filters.type !== "all") {
    filterLines.push(`Tipo: ${getTypeLabel(data.filters.type)}`)
  }

  if (data.filters.lowStock) {
    filterLines.push("Filtro: Apenas produtos com estoque baixo")
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

  // Filter products
  const filteredProducts = filterProducts(data.products, data.filters)

  // Sort by name
  const sortedProducts = [...filteredProducts].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  // Prepare table data
  const headers = ["Produto", "Categoria", "Tipo", "Estoque Atual", "Estoque Mín.", "Preço Unit.", "Valor Total"]
  const rows = sortedProducts.map(product => {
    const totalValue = product.currentStock * product.unitPrice
    const stockStatus = product.currentStock < product.minimumStock ? "⚠️ " : ""

    return [
      stockStatus + product.name,
      getCategoryName(product.categoryId, data.categories),
      getTypeLabel(product.type),
      product.currentStock.toString(),
      product.minimumStock.toString(),
      formatCurrency(product.unitPrice),
      formatCurrency(totalValue),
    ]
  })

  // Add table
  yPos = addTableToPDF(doc, headers, rows, yPos)

  // Add summary statistics
  yPos += 5
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Resumo", 15, yPos)
  yPos += 7

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")

  const totalProducts = sortedProducts.length
  const totalStockValue = sortedProducts.reduce(
    (sum, p) => sum + (p.currentStock * p.unitPrice),
    0
  )

  const lowStockProducts = sortedProducts.filter(
    p => p.currentStock < p.minimumStock
  )

  const consumableProducts = sortedProducts.filter(p => p.type === "consumable")
  const sellableProducts = sortedProducts.filter(p => p.type === "sellable")

  doc.text(`Total de Produtos: ${totalProducts}`, 15, yPos)
  yPos += 5
  doc.text(`Valor Total em Estoque: ${formatCurrency(totalStockValue)}`, 15, yPos)
  yPos += 5

  if (lowStockProducts.length > 0) {
    doc.setTextColor(200, 0, 0)
    doc.text(`⚠️ Produtos com Estoque Baixo: ${lowStockProducts.length}`, 15, yPos)
    doc.setTextColor(0, 0, 0)
    yPos += 7
  } else {
    yPos += 2
  }

  doc.text("Distribuição por Tipo:", 15, yPos)
  yPos += 5
  doc.text(`  Consumíveis: ${consumableProducts.length} (${formatCurrency(
    consumableProducts.reduce((sum, p) => sum + (p.currentStock * p.unitPrice), 0)
  )})`, 15, yPos)
  yPos += 5
  doc.text(`  Vendáveis: ${sellableProducts.length} (${formatCurrency(
    sellableProducts.reduce((sum, p) => sum + (p.currentStock * p.unitPrice), 0)
  )})`, 15, yPos)
  yPos += 7

  // Category breakdown
  const categoryStats = new Map<string, { count: number; value: number }>()
  sortedProducts.forEach(product => {
    const categoryName = getCategoryName(product.categoryId, data.categories)
    const existing = categoryStats.get(categoryName) || { count: 0, value: 0 }
    categoryStats.set(categoryName, {
      count: existing.count + 1,
      value: existing.value + (product.currentStock * product.unitPrice),
    })
  })

  if (categoryStats.size > 0) {
    doc.text("Distribuição por Categoria:", 15, yPos)
    yPos += 5

    Array.from(categoryStats.entries())
      .sort((a, b) => b[1].value - a[1].value)
      .forEach(([category, stats]) => {
        doc.text(`  ${category}: ${stats.count} produtos (${formatCurrency(stats.value)})`, 15, yPos)
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
 * Downloads the stock report as a PDF file
 *
 * @param data - Report data
 * @param systemSettings - System settings
 * @param filename - Optional custom filename (without extension)
 */
export function downloadStockReport(
  data: StockReportData,
  systemSettings: SystemSettings,
  filename?: string
): void {
  const blob = generateStockReport(data, systemSettings)

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split("T")[0]
  const defaultFilename = `relatorio-estoque-${timestamp}.pdf`
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
