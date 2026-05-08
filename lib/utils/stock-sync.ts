import type { POSProduct, StockItem } from "../store"

/**
 * Utility for synchronizing products and stock items
 */

export interface SyncIssue {
  type: "missing_stock" | "orphaned_stock" | "name_mismatch"
  severity: "high" | "medium" | "low"
  productId?: string
  productName?: string
  stockItemId?: string
  stockItemName?: string
  description: string
  autoFixable: boolean
}

export interface SyncReport {
  timestamp: string
  totalProducts: number
  totalStockItems: number
  productsWithTrackStock: number
  issues: SyncIssue[]
  summary: {
    missingStock: number
    orphanedStock: number
    nameMismatches: number
  }
}

/**
 * Analyze product-stock synchronization and generate a report
 */
export function analyzeSyncStatus(
  products: POSProduct[],
  stockItems: StockItem[]
): SyncReport {
  const issues: SyncIssue[] = []
  
  const productsWithTrackStock = products.filter(p => p.trackStock)
  
  // Find products with trackStock but no stock item
  for (const product of productsWithTrackStock) {
    const hasStock = stockItems.some(s => s.productId === product.id)
    if (!hasStock) {
      issues.push({
        type: "missing_stock",
        severity: "high",
        productId: product.id,
        productName: product.name,
        description: `Produto "${product.name}" tem trackStock ativado mas não possui item de estoque`,
        autoFixable: true,
      })
    }
  }
  
  // Find orphaned stock items (no matching product)
  for (const stockItem of stockItems) {
    const product = products.find(p => p.id === stockItem.productId)
    if (!product) {
      issues.push({
        type: "orphaned_stock",
        severity: "medium",
        stockItemId: stockItem.id,
        stockItemName: stockItem.productName,
        description: `Item de estoque "${stockItem.productName}" não possui produto correspondente`,
        autoFixable: false,
      })
    }
  }
  
  // Find name mismatches
  for (const product of products) {
    const stockItem = stockItems.find(s => s.productId === product.id)
    if (stockItem && stockItem.productName !== product.name) {
      issues.push({
        type: "name_mismatch",
        severity: "low",
        productId: product.id,
        productName: product.name,
        stockItemId: stockItem.id,
        stockItemName: stockItem.productName,
        description: `Nome do produto "${product.name}" não corresponde ao nome no estoque "${stockItem.productName}"`,
        autoFixable: true,
      })
    }
  }
  
  return {
    timestamp: new Date().toISOString(),
    totalProducts: products.length,
    totalStockItems: stockItems.length,
    productsWithTrackStock: productsWithTrackStock.length,
    issues,
    summary: {
      missingStock: issues.filter(i => i.type === "missing_stock").length,
      orphanedStock: issues.filter(i => i.type === "orphaned_stock").length,
      nameMismatches: issues.filter(i => i.type === "name_mismatch").length,
    },
  }
}

/**
 * Generate auto-fix actions for synchronization issues
 */
export function generateAutoFixes(
  report: SyncReport,
  products: POSProduct[]
): Array<{
  action: "create_stock" | "update_stock_name"
  productId?: string
  stockItemId?: string
  data: Partial<StockItem>
}> {
  const fixes: Array<{
    action: "create_stock" | "update_stock_name"
    productId?: string
    stockItemId?: string
    data: Partial<StockItem>
  }> = []
  
  for (const issue of report.issues) {
    if (!issue.autoFixable) continue
    
    if (issue.type === "missing_stock" && issue.productId) {
      const product = products.find(p => p.id === issue.productId)
      if (product) {
        fixes.push({
          action: "create_stock",
          productId: product.id,
          data: {
            id: `STK${Date.now()}_${product.id}`,
            productId: product.id,
            productName: product.name,
            currentStock: 0,
            unit: "un",
            minimumStock: 10,
            maximumStock: 100,
            averageCost: product.price * 0.6,
            lastPurchasePrice: product.price * 0.6,
            lastPurchaseDate: new Date().toISOString().split("T")[0],
          },
        })
      }
    }
    
    if (issue.type === "name_mismatch" && issue.stockItemId && issue.productName) {
      fixes.push({
        action: "update_stock_name",
        stockItemId: issue.stockItemId,
        data: {
          productName: issue.productName,
        },
      })
    }
  }
  
  return fixes
}

/**
 * Format sync report as human-readable text
 */
export function formatSyncReport(report: SyncReport): string {
  const lines: string[] = []
  
  lines.push("=== RELATÓRIO DE SINCRONIZAÇÃO PRODUTO-ESTOQUE ===")
  lines.push(`Data: ${new Date(report.timestamp).toLocaleString("pt-BR")}`)
  lines.push("")
  lines.push("RESUMO:")
  lines.push(`- Total de produtos: ${report.totalProducts}`)
  lines.push(`- Produtos com controle de estoque: ${report.productsWithTrackStock}`)
  lines.push(`- Total de itens de estoque: ${report.totalStockItems}`)
  lines.push("")
  lines.push("PROBLEMAS ENCONTRADOS:")
  lines.push(`- Produtos sem estoque: ${report.summary.missingStock}`)
  lines.push(`- Itens de estoque órfãos: ${report.summary.orphanedStock}`)
  lines.push(`- Divergências de nome: ${report.summary.nameMismatches}`)
  lines.push("")
  
  if (report.issues.length === 0) {
    lines.push("✓ Nenhum problema encontrado. Sistema sincronizado!")
  } else {
    lines.push("DETALHES DOS PROBLEMAS:")
    lines.push("")
    
    const highSeverity = report.issues.filter(i => i.severity === "high")
    const mediumSeverity = report.issues.filter(i => i.severity === "medium")
    const lowSeverity = report.issues.filter(i => i.severity === "low")
    
    if (highSeverity.length > 0) {
      lines.push("ALTA PRIORIDADE:")
      for (const issue of highSeverity) {
        lines.push(`  - ${issue.description}`)
        lines.push(`    ${issue.autoFixable ? "✓ Pode ser corrigido automaticamente" : "✗ Requer correção manual"}`)
      }
      lines.push("")
    }
    
    if (mediumSeverity.length > 0) {
      lines.push("MÉDIA PRIORIDADE:")
      for (const issue of mediumSeverity) {
        lines.push(`  - ${issue.description}`)
        lines.push(`    ${issue.autoFixable ? "✓ Pode ser corrigido automaticamente" : "✗ Requer correção manual"}`)
      }
      lines.push("")
    }
    
    if (lowSeverity.length > 0) {
      lines.push("BAIXA PRIORIDADE:")
      for (const issue of lowSeverity) {
        lines.push(`  - ${issue.description}`)
        lines.push(`    ${issue.autoFixable ? "✓ Pode ser corrigido automaticamente" : "✗ Requer correção manual"}`)
      }
      lines.push("")
    }
  }
  
  return lines.join("\n")
}
