/**
 * Report Types
 * 
 * Defines types for the reporting system
 */

export interface DailySummary {
  date: string
  totalSales: number
  totalRevenue: number
  averageTicket: number
  transactionCount: number
  cashRevenue: number
  debitRevenue: number
  creditRevenue: number
  pixRevenue: number
  previousDayRevenue?: number
  revenueChange?: number // percentage
}

export interface SalesByCategory {
  category: string
  revenue: number
  quantity: number
  percentage: number
}

export interface SalesByPaymentMethod {
  method: string
  revenue: number
  count: number
  percentage: number
}

export interface TopProduct {
  productId: string
  productName: string
  category: string
  quantity: number
  revenue: number
  averagePrice: number
}

export interface HourlySales {
  hour: number
  revenue: number
  transactionCount: number
}

export interface StockAlert {
  productId: string
  productName: string
  currentStock: number
  minimumStock: number
  unit: string
  status: 'critical' | 'low'
}

export interface CashFlowSummary {
  date: string
  openingBalance: number
  closingBalance: number
  totalRevenue: number
  totalExpenses: number
  netFlow: number
  withdrawals: number
  deposits: number
}

export interface ProductionSummary {
  date: string
  totalProductions: number
  totalCost: number
  averageYield: number
  topRecipes: Array<{
    recipeName: string
    productionCount: number
    totalCost: number
  }>
}

export interface ReportFilters {
  startDate?: string
  endDate?: string
  category?: string
  paymentMethod?: string
  productId?: string
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf'
  filename?: string
  includeCharts?: boolean
}
