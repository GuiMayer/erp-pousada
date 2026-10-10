import { pousadaStock } from "@/lib/pousada-scope"
import { businessDay, businessHour, normalizePayment, netItemValues } from "../utils/business-values"
import { useCallback, useMemo } from "react"
import { useApp } from "../app-context"
import type {
  DailySummary,
  SalesByCategory,
  SalesByPaymentMethod,
  TopProduct,
  HourlySales,
  StockAlert,
  CashFlowSummary,
} from "../types/reports"

/**
 * Hook for generating reports and analytics
 *
 * Provides functions to calculate daily summaries, sales by category,
 * top products, and other business metrics
 */
export function useReports() {
  const {
    posSales,
    transactions,
    cashCloses,
    stockItems: allStockItems, productCategories,
    posProducts,
    getCategoryName,
  } = useApp()

  const stockItems = useMemo(() => pousadaStock(allStockItems, posProducts, productCategories), [allStockItems, posProducts, productCategories])

  /**
   * Get daily summary for a specific date
   */
  const getDailySummary = useCallback((date: string): DailySummary => {
    const datePrefix = date.split('T')[0]

    // Filter sales for the date
    const daySales = posSales.filter(s =>
      businessDay(s.date) === datePrefix && s.status === "concluida"
    )

    const totalRevenue = daySales.reduce((sum, s) => sum + s.total, 0)
    const transactionCount = daySales.length
    const averageTicket = transactionCount > 0 ? totalRevenue / transactionCount : 0

    // Revenue by payment method
    const cashRevenue = daySales
      .filter(s => normalizePayment(s.paymentMethod) === "Dinheiro")
      .reduce((sum, s) => sum + s.total, 0)

    const debitRevenue = daySales
      .filter(s => normalizePayment(s.paymentMethod) === "Cartao Debito")
      .reduce((sum, s) => sum + s.total, 0)

    const creditRevenue = daySales
      .filter(s => normalizePayment(s.paymentMethod) === "Cartao Credito")
      .reduce((sum, s) => sum + s.total, 0)

    const pixRevenue = daySales
      .filter(s => normalizePayment(s.paymentMethod) === "PIX")
      .reduce((sum, s) => sum + s.total, 0)

    // Calculate previous day for comparison
    const prevDate = new Date(date)
    prevDate.setDate(prevDate.getDate() - 1)
    const prevDatePrefix = prevDate.toISOString().split('T')[0]

    const prevDaySales = posSales.filter(s =>
      businessDay(s.date) === prevDatePrefix && s.status === "concluida"
    )
    const previousDayRevenue = prevDaySales.reduce((sum, s) => sum + s.total, 0)

    const revenueChange = previousDayRevenue > 0
      ? ((totalRevenue - previousDayRevenue) / previousDayRevenue) * 100
      : 0

    return {
      date: datePrefix,
      totalSales: daySales.length,
      totalRevenue,
      averageTicket,
      transactionCount,
      cashRevenue,
      debitRevenue,
      creditRevenue,
      pixRevenue,
      previousDayRevenue,
      revenueChange,
    }
  }, [posSales])

  /**
   * Get sales grouped by category for a specific date
   */
  const getSalesByCategory = useCallback((date: string): SalesByCategory[] => {
    const datePrefix = date.split('T')[0]

    const daySales = posSales.filter(s =>
      businessDay(s.date) === datePrefix && s.status === "concluida"
    )

    const categoryMap = new Map<string, { revenue: number; quantity: number }>()

    daySales.forEach(sale => {
      sale.items.forEach((item, itemIndex) => {
        const category = getCategoryName(item.product.categoryId)
        const existing = categoryMap.get(category) || { revenue: 0, quantity: 0 }

        categoryMap.set(category, {
          revenue: existing.revenue + netItemValues(sale)[itemIndex],
          quantity: existing.quantity + item.quantity,
        })
      })
    })

    const totalRevenue = Array.from(categoryMap.values())
      .reduce((sum, cat) => sum + cat.revenue, 0)

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        revenue: data.revenue,
        quantity: data.quantity,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [getCategoryName, posSales])

  /**
   * Get sales grouped by payment method for a specific date
   */
  const getSalesByPaymentMethod = useCallback((date: string): SalesByPaymentMethod[] => {
    const datePrefix = date.split('T')[0]

    const daySales = posSales.filter(s =>
      businessDay(s.date) === datePrefix && s.status === "concluida"
    )

    const methodMap = new Map<string, { revenue: number; count: number }>()

    daySales.forEach(sale => {
      const method = normalizePayment(sale.paymentMethod)
      const existing = methodMap.get(method) || { revenue: 0, count: 0 }

      methodMap.set(method, {
        revenue: existing.revenue + sale.total,
        count: existing.count + 1,
      })
    })

    const totalRevenue = Array.from(methodMap.values())
      .reduce((sum, m) => sum + m.revenue, 0)

    return Array.from(methodMap.entries())
      .map(([method, data]) => ({
        method,
        revenue: data.revenue,
        count: data.count,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [posSales])

  /**
   * Get top selling products for a specific date
   */
  const getTopProducts = useCallback((date: string, limit: number = 10): TopProduct[] => {
    const datePrefix = date.split('T')[0]

    const daySales = posSales.filter(s =>
      businessDay(s.date) === datePrefix && s.status === "concluida"
    )

    const productMap = new Map<string, {
      name: string
      category: string
      quantity: number
      revenue: number
      totalPrice: number
    }>()

    daySales.forEach(sale => {
      sale.items.forEach((item, itemIndex) => {
        const productId = item.product.id
        const existing = productMap.get(productId) || {
          name: item.product.name,
          category: getCategoryName(item.product.categoryId),
          quantity: 0,
          revenue: 0,
          totalPrice: 0,
        }

        const itemRevenue = netItemValues(sale)[itemIndex]

        productMap.set(productId, {
          name: existing.name,
          category: existing.category,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + itemRevenue,
          totalPrice: existing.totalPrice + (item.product.price * item.quantity),
        })
      })
    })

    return Array.from(productMap.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        category: data.category,
        quantity: data.quantity,
        revenue: data.revenue,
        averagePrice: data.quantity > 0 ? data.totalPrice / data.quantity : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
  }, [getCategoryName, posSales])

  /**
   * Get hourly sales distribution for a specific date
   */
  const getHourlySales = useCallback((date: string): HourlySales[] => {
    const datePrefix = date.split('T')[0]

    const daySales = posSales.filter(s =>
      businessDay(s.date) === datePrefix && s.status === "concluida"
    )

    const hourMap = new Map<number, { revenue: number; count: number }>()

    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      hourMap.set(i, { revenue: 0, count: 0 })
    }

    daySales.forEach(sale => {
      const hour = businessHour(sale.date)
      const existing = hourMap.get(hour)!

      hourMap.set(hour, {
        revenue: existing.revenue + sale.total,
        count: existing.count + 1,
      })
    })

    return Array.from(hourMap.entries())
      .map(([hour, data]) => ({
        hour,
        revenue: data.revenue,
        transactionCount: data.count,
      }))
      .sort((a, b) => a.hour - b.hour)
  }, [posSales])

  /**
   * Get stock alerts (low and critical stock items)
   */
  const getStockAlerts = useCallback((): StockAlert[] => {
    return stockItems
      .filter(item => item.currentStock <= item.minimumStock * 1.5)
      .map(item => ({
        productId: item.productId,
        productName: item.productName,
        currentStock: item.currentStock,
        minimumStock: item.minimumStock,
        unit: item.unit,
        status: item.currentStock <= item.minimumStock ? 'critical' as const : 'low' as const,
      }))
      .sort((a, b) => {
        // Critical first, then by stock level
        if (a.status !== b.status) {
          return a.status === 'critical' ? -1 : 1
        }
        return a.currentStock - b.currentStock
      })
  }, [stockItems])

  /**
   * Get revenue trend for a date range
   */
  const getRevenueTrend = useCallback((startDate: string, endDate: string): Array<{
    date: string
    revenue: number
    transactionCount: number
  }> => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const trendData: Array<{ date: string; revenue: number; transactionCount: number }> = []

    // Generate data for each day in the range
    const currentDate = new Date(start)
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0]

      const daySales = posSales.filter(s =>
        businessDay(s.date) === dateStr && s.status === "concluida"
      )

      trendData.push({
        date: dateStr,
        revenue: daySales.reduce((sum, s) => sum + s.total, 0),
        transactionCount: daySales.length,
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return trendData
  }, [posSales])

  /**
   * Get cash flow summary for a specific date
   */
  const getCashFlowSummary = useCallback((date: string): CashFlowSummary | null => {
    const datePrefix = date.split('T')[0]

    const closedSessions = cashCloses.filter(c => c.status !== "aberto" && businessDay(c.date) === datePrefix)
    if (!closedSessions.length) return null
    const sessionIds = new Set(closedSessions.filter(c => c.status).map(c => c.id))
    const legacy = closedSessions.some(c => !c.status)
    const dayTransactions = transactions.filter(t => t.cashSessionId ? sessionIds.has(t.cashSessionId) : legacy && businessDay(t.date) === datePrefix && normalizePayment(t.paymentMethod || "") === "Dinheiro")

    const totalRevenue = dayTransactions
      .filter(t => t.type === "receita")
      .reduce((sum, t) => sum + t.value, 0)

    const totalExpenses = dayTransactions
      .filter(t => t.type === "despesa" || t.type === "estorno")
      .reduce((sum, t) => sum + t.value, 0)

    const withdrawals = dayTransactions.filter(t => t.type === "despesa").reduce((sum,t) => sum + t.value, 0)
    const deposits = dayTransactions.filter(t => t.type === "receita").reduce((sum,t) => sum + t.value, 0)

    return {
      date: datePrefix,
      openingBalance: closedSessions.reduce((sum, session) => sum + (session.openingValue ?? 0), 0),
      closingBalance: closedSessions.reduce((sum, session) => sum + session.physicalValue, 0),
      totalRevenue,
      totalExpenses,
      netFlow: totalRevenue - totalExpenses,
      withdrawals,
      deposits,
    }
  }, [cashCloses, transactions])

  /**
   * Get period summary for a date range
   */
  const getPeriodSummary = useCallback((startDate: string, endDate: string): DailySummary => {
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Filter sales for the date range
    const periodSales = posSales.filter(s => {
      const saleDate = new Date(businessDay(s.date))
      return saleDate >= start && saleDate <= end && s.status === "concluida"
    })

    const totalRevenue = periodSales.reduce((sum, s) => sum + s.total, 0)
    const transactionCount = periodSales.length
    const averageTicket = transactionCount > 0 ? totalRevenue / transactionCount : 0

    // Revenue by payment method
    const cashRevenue = periodSales
      .filter(s => normalizePayment(s.paymentMethod) === "Dinheiro")
      .reduce((sum, s) => sum + s.total, 0)

    const debitRevenue = periodSales
      .filter(s => normalizePayment(s.paymentMethod) === "Cartao Debito")
      .reduce((sum, s) => sum + s.total, 0)

    const creditRevenue = periodSales
      .filter(s => normalizePayment(s.paymentMethod) === "Cartao Credito")
      .reduce((sum, s) => sum + s.total, 0)

    const pixRevenue = periodSales
      .filter(s => normalizePayment(s.paymentMethod) === "PIX")
      .reduce((sum, s) => sum + s.total, 0)

    // Calculate previous period for comparison
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - daysDiff)
    const prevEnd = new Date(end)
    prevEnd.setDate(prevEnd.getDate() - daysDiff)

    const prevPeriodSales = posSales.filter(s => {
      const saleDate = new Date(businessDay(s.date))
      return saleDate >= prevStart && saleDate <= prevEnd && s.status === "concluida"
    })
    const previousPeriodRevenue = prevPeriodSales.reduce((sum, s) => sum + s.total, 0)

    const revenueChange = previousPeriodRevenue > 0
      ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
      : 0

    return {
      date: `${startDate} - ${endDate}`,
      totalSales: periodSales.length,
      totalRevenue,
      averageTicket,
      transactionCount,
      cashRevenue,
      debitRevenue,
      creditRevenue,
      pixRevenue,
      previousDayRevenue: previousPeriodRevenue,
      revenueChange,
    }
  }, [posSales])

  /**
   * Get sales by category for a date range
   */
  const getPeriodSalesByCategory = useCallback((startDate: string, endDate: string): SalesByCategory[] => {
    const start = new Date(startDate)
    const end = new Date(endDate)

    const periodSales = posSales.filter(s => {
      const saleDate = new Date(businessDay(s.date))
      return saleDate >= start && saleDate <= end && s.status === "concluida"
    })

    const categoryMap = new Map<string, { revenue: number; quantity: number }>()

    periodSales.forEach(sale => {
      sale.items.forEach((item, itemIndex) => {
        const category = getCategoryName(item.product.categoryId)
        const existing = categoryMap.get(category) || { revenue: 0, quantity: 0 }

        categoryMap.set(category, {
          revenue: existing.revenue + netItemValues(sale)[itemIndex],
          quantity: existing.quantity + item.quantity,
        })
      })
    })

    const totalRevenue = Array.from(categoryMap.values())
      .reduce((sum, cat) => sum + cat.revenue, 0)

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        revenue: data.revenue,
        quantity: data.quantity,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [getCategoryName, posSales])

  /**
   * Get sales by payment method for a date range
   */
  const getPeriodSalesByPaymentMethod = useCallback((startDate: string, endDate: string): SalesByPaymentMethod[] => {
    const start = new Date(startDate)
    const end = new Date(endDate)

    const periodSales = posSales.filter(s => {
      const saleDate = new Date(businessDay(s.date))
      return saleDate >= start && saleDate <= end && s.status === "concluida"
    })

    const methodMap = new Map<string, { revenue: number; count: number }>()

    periodSales.forEach(sale => {
      const method = normalizePayment(sale.paymentMethod)
      const existing = methodMap.get(method) || { revenue: 0, count: 0 }

      methodMap.set(method, {
        revenue: existing.revenue + sale.total,
        count: existing.count + 1,
      })
    })

    const totalRevenue = Array.from(methodMap.values())
      .reduce((sum, m) => sum + m.revenue, 0)

    return Array.from(methodMap.entries())
      .map(([method, data]) => ({
        method,
        revenue: data.revenue,
        count: data.count,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [posSales])

  /**
   * Get top products for a date range
   */
  const getPeriodTopProducts = useCallback((startDate: string, endDate: string, limit: number = 10): TopProduct[] => {
    const start = new Date(startDate)
    const end = new Date(endDate)

    const periodSales = posSales.filter(s => {
      const saleDate = new Date(businessDay(s.date))
      return saleDate >= start && saleDate <= end && s.status === "concluida"
    })

    const productMap = new Map<string, {
      name: string
      category: string
      quantity: number
      revenue: number
      totalPrice: number
    }>()

    periodSales.forEach(sale => {
      sale.items.forEach((item, itemIndex) => {
        const productId = item.product.id
        const existing = productMap.get(productId) || {
          name: item.product.name,
          category: getCategoryName(item.product.categoryId),
          quantity: 0,
          revenue: 0,
          totalPrice: 0,
        }

        const itemRevenue = netItemValues(sale)[itemIndex]

        productMap.set(productId, {
          name: existing.name,
          category: existing.category,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + itemRevenue,
          totalPrice: existing.totalPrice + (item.product.price * item.quantity),
        })
      })
    })

    return Array.from(productMap.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        category: data.category,
        quantity: data.quantity,
        revenue: data.revenue,
        averagePrice: data.quantity > 0 ? data.totalPrice / data.quantity : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
  }, [getCategoryName, posSales])

  return {
    getDailySummary,
    getSalesByCategory,
    getSalesByPaymentMethod,
    getTopProducts,
    getHourlySales,
    getStockAlerts,
    getCashFlowSummary,
    getPeriodSummary,
    getPeriodSalesByCategory,
    getPeriodSalesByPaymentMethod,
    getPeriodTopProducts,
    getRevenueTrend,
  }
}
