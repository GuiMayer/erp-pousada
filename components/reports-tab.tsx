/**
 * Reports Tab Component - Sidebar Layout
 * 
 * Radical UX restructure with actions sidebar:
 * - Main content area: Charts and visualizations
 * - Right sidebar: All export actions (CSV + PDF)
 * - Single-level tabs: Overview | Vendas | Produtos | Estoque
 * - Compact period selector in header
 * - No redundant explanatory cards
 */

"use client"

import { useState } from "react"
import { useReports } from "@/lib/hooks/useReports"
import { useUserPreferences } from "@/contexts/user-preferences-context"
import { useApp } from "@/lib/app-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart,
  Package,
} from "lucide-react"
import { MetricCard } from "./reports/metric-card"
import { SalesByCategoryChart } from "./reports/sales-by-category-chart"
import { PaymentMethodChart } from "./reports/payment-method-chart"
import { HourlySalesChart } from "./reports/hourly-sales-chart"
import { TopProductsTable } from "./reports/top-products-table"
import { StockAlertsCard } from "./reports/stock-alerts-card"
import { CompactPeriodSelector } from "./reports/compact-period-selector"
import { RevenueTrendChart } from "./reports/revenue-trend-chart"
import { PeriodComparisonCard } from "./reports/period-comparison-card"
import { ActionsSidebar } from "./reports/actions-sidebar"
import { ExportDropdownMenu } from "./reports/export-dropdown-menu"
import { 
  exportDailySummaryToCSV, 
  exportTopProductsToCSV,
  exportSalesByCategoryToCSV,
  exportPaymentMethodToCSV,
  exportRevenueTrendToCSV,
  exportStockAlertsToCSV,
  exportCompleteReport,
} from "@/lib/utils/csv-export"
import { downloadReservationsReport } from "@/lib/reports/reservations-report"
import { downloadStockReport } from "@/lib/reports/stock-report"
import { downloadRestaurantReport } from "@/lib/reports/restaurant-report"
import { getTodayISO } from "@/lib/utils/constants"
import { toast } from "sonner"
import type { Reservation, Product, RestaurantOrder } from "@/lib/store"

export function ReportsTab() {
  const { preferences } = useUserPreferences()
  const { 
    reservations, 
    rooms, 
    posProducts: products, 
    productCategories,
    restaurantOrders,
    systemSettings 
  } = useApp()

  // Period state
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [startDate, setStartDate] = useState(getTodayISO())
  const [endDate, setEndDate] = useState(getTodayISO())
  
  // Loading states
  const [isExporting, setIsExporting] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  // PDF Report filters - Reservations
  const [reservationStatus, setReservationStatus] = useState<Reservation["status"] | "all">("all")
  const [reservationRoomId, setReservationRoomId] = useState<string | "all">("all")

  // PDF Report filters - Stock
  const [stockCategoryId, setStockCategoryId] = useState<string | "all">("all")
  const [stockType, setStockType] = useState<Product["type"] | "all">("all")
  const [stockLowStock, setStockLowStock] = useState(false)

  // PDF Report filters - Restaurant
  const [restaurantStatus, setRestaurantStatus] = useState<RestaurantOrder["status"] | "all">("all")
  const [restaurantCategoryId, setRestaurantCategoryId] = useState<string | "all">("all")

  const {
    getDailySummary,
    getSalesByCategory,
    getSalesByPaymentMethod,
    getTopProducts,
    getHourlySales,
    getStockAlerts,
    getPeriodSummary,
    getPeriodSalesByCategory,
    getPeriodSalesByPaymentMethod,
    getPeriodTopProducts,
    getRevenueTrend,
  } = useReports()

  // Handle period changes
  const handlePeriodChange = (period: 'today' | 'week' | 'month' | 'custom') => {
    setSelectedPeriod(period)
    const today = new Date()
    
    if (period === 'today') {
      const todayStr = getTodayISO()
      setStartDate(todayStr)
      setEndDate(todayStr)
    } else if (period === 'week') {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 6)
      setStartDate(weekAgo.toISOString().split('T')[0])
      setEndDate(today.toISOString().split('T')[0])
    } else if (period === 'month') {
      const monthAgo = new Date(today)
      monthAgo.setDate(monthAgo.getDate() - 29)
      setStartDate(monthAgo.toISOString().split('T')[0])
      setEndDate(today.toISOString().split('T')[0])
    }
  }

  // Get data based on selected period
  const isMultiDay = selectedPeriod !== 'today' || startDate !== endDate
  
  const dailySummary = isMultiDay 
    ? getPeriodSummary(startDate, endDate)
    : getDailySummary(startDate)
  
  const salesByCategory = isMultiDay
    ? getPeriodSalesByCategory(startDate, endDate)
    : getSalesByCategory(startDate)
  
  const salesByPaymentMethod = isMultiDay
    ? getPeriodSalesByPaymentMethod(startDate, endDate)
    : getSalesByPaymentMethod(startDate)
  
  const topProducts = isMultiDay
    ? getPeriodTopProducts(startDate, endDate, 10)
    : getTopProducts(startDate, 10)
  
  const hourlySales = getHourlySales(startDate)
  const stockAlerts = getStockAlerts()
  const revenueTrend = isMultiDay ? getRevenueTrend(startDate, endDate) : []

  // CSV Export handlers with loading states
  const handleExportWithLoading = async (exportFn: () => void) => {
    setIsExporting(true)
    try {
      exportFn()
      toast.success("Arquivo CSV exportado com sucesso!")
    } catch (error) {
      console.error("Error exporting CSV:", error)
      toast.error("Erro ao exportar arquivo CSV")
    } finally {
      setTimeout(() => setIsExporting(false), 500)
    }
  }

  const handleExportDailySummary = () => {
    const dateLabel = isMultiDay ? `${startDate}_${endDate}` : startDate
    handleExportWithLoading(() => exportDailySummaryToCSV(dailySummary, dateLabel))
  }

  const handleExportTopProducts = () => {
    const dateLabel = isMultiDay ? `${startDate}_${endDate}` : startDate
    handleExportWithLoading(() => exportTopProductsToCSV(topProducts, dateLabel))
  }

  const handleExportSalesByCategory = () => {
    const dateLabel = isMultiDay ? `${startDate}_${endDate}` : startDate
    handleExportWithLoading(() => exportSalesByCategoryToCSV(salesByCategory, dateLabel))
  }

  const handleExportPaymentMethod = () => {
    const dateLabel = isMultiDay ? `${startDate}_${endDate}` : startDate
    handleExportWithLoading(() => exportPaymentMethodToCSV(salesByPaymentMethod, dateLabel))
  }

  const handleExportRevenueTrend = () => {
    const dateLabel = `${startDate}_${endDate}`
    handleExportWithLoading(() => exportRevenueTrendToCSV(revenueTrend, dateLabel))
  }

  const handleExportStockAlerts = () => {
    handleExportWithLoading(() => exportStockAlertsToCSV(stockAlerts))
  }

  const handleExportCompleteReport = () => {
    const dateLabel = isMultiDay ? `${startDate}_${endDate}` : startDate
    handleExportWithLoading(() => exportCompleteReport(
      dailySummary,
      salesByCategory,
      salesByPaymentMethod,
      topProducts,
      dateLabel
    ))
  }

  // PDF Report handlers with loading states
  const handlePDFWithLoading = async (pdfFn: () => void) => {
    setIsGeneratingPDF(true)
    try {
      pdfFn()
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast.error("Erro ao gerar relatório PDF")
    } finally {
      setTimeout(() => setIsGeneratingPDF(false), 1000)
    }
  }

  const handleGenerateReservationsPDF = () => {
    handlePDFWithLoading(() => {
      downloadReservationsReport(
        {
          reservations,
          rooms,
          filters: {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            status: reservationStatus,
            roomId: reservationRoomId,
          },
        },
        systemSettings
      )
      toast.success("Relatório de reservas gerado com sucesso!")
    })
  }

  const handleGenerateStockPDF = () => {
    handlePDFWithLoading(() => {
      downloadStockReport(
        {
          products,
          categories: productCategories,
          filters: {
            categoryId: stockCategoryId,
            type: stockType,
            lowStock: stockLowStock,
          },
        },
        systemSettings
      )
      toast.success("Relatório de estoque gerado com sucesso!")
    })
  }

  const handleGenerateRestaurantPDF = () => {
    handlePDFWithLoading(() => {
      downloadRestaurantReport(
        {
          orders: restaurantOrders,
          products: products,
          categories: productCategories,
          filters: {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            status: restaurantStatus,
            categoryId: restaurantCategoryId,
          },
        },
        systemSettings
      )
      toast.success("Relatório de restaurante gerado com sucesso!")
    })
  }

  return (
    <div className="space-y-6">
      {/* Header with compact period selector */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Relatórios</h2>
          <p className="text-muted-foreground">
            Análise de vendas e geração de relatórios
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <CompactPeriodSelector
            selectedPeriod={selectedPeriod}
            startDate={startDate}
            endDate={endDate}
            onPeriodChange={handlePeriodChange}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          
          {/* Mobile export dropdown */}
          <div className="lg:hidden">
            <ExportDropdownMenu
              onExportComplete={handleExportCompleteReport}
              onExportSummary={handleExportDailySummary}
              onExportCategories={handleExportSalesByCategory}
              onExportPayments={handleExportPaymentMethod}
              onExportTopProducts={handleExportTopProducts}
              onExportRevenueTrend={handleExportRevenueTrend}
              onExportStockAlerts={handleExportStockAlerts}
              onGenerateReservationsPDF={handleGenerateReservationsPDF}
              onGenerateStockPDF={handleGenerateStockPDF}
              onGenerateRestaurantPDF={handleGenerateRestaurantPDF}
              showRevenueTrend={isMultiDay && revenueTrend.length > 0}
              isExporting={isExporting}
              isGeneratingPDF={isGeneratingPDF}
            />
          </div>
        </div>
      </div>

      {/* Main layout: Content + Sidebar */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Main content area */}
        <div className="flex-1 min-w-0 w-full">
          {/* Key Metrics - Always visible */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <MetricCard
              title="Receita Total"
              value={dailySummary.totalRevenue}
              format="currency"
              icon={<DollarSign className="h-5 w-5" />}
              trend={
                dailySummary.revenueChange !== undefined
                  ? {
                      value: dailySummary.revenueChange,
                      label: "vs período anterior",
                    }
                  : undefined
              }
            />
            <MetricCard
              title="Vendas"
              value={dailySummary.totalSales}
              format="number"
              icon={<ShoppingCart className="h-5 w-5" />}
              subtitle={`${dailySummary.transactionCount} transações`}
            />
            <MetricCard
              title="Ticket Médio"
              value={dailySummary.averageTicket}
              format="currency"
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <MetricCard
              title="Alertas de Estoque"
              value={stockAlerts.length}
              format="number"
              icon={<Package className="h-5 w-5" />}
              subtitle={`${stockAlerts.filter(a => a.status === 'critical').length} críticos`}
            />
          </div>

          {/* Revenue Trend - Only for multi-day periods */}
          {isMultiDay && revenueTrend.length > 0 && (
            <div className="mb-6">
              <RevenueTrendChart data={revenueTrend} enableAnimations={preferences.enableChartAnimations} />
            </div>
          )}

          {/* Period Comparison - Only for multi-day periods */}
          {isMultiDay && (
            <div className="mb-6">
              <PeriodComparisonCard
                currentPeriod={{
                  label: selectedPeriod === 'week' ? 'Esta Semana' : selectedPeriod === 'month' ? 'Este Mês' : 'Período Atual',
                  revenue: dailySummary.totalRevenue,
                  transactions: dailySummary.transactionCount,
                  averageTicket: dailySummary.averageTicket,
                }}
                previousPeriod={{
                  label: selectedPeriod === 'week' ? 'Semana Anterior' : selectedPeriod === 'month' ? 'Mês Anterior' : 'Período Anterior',
                  revenue: dailySummary.previousDayRevenue,
                  transactions: 0,
                  averageTicket: 0,
                }}
              />
            </div>
          )}

          {/* Tabs for detailed views */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="sales">Vendas</TabsTrigger>
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="stock">Estoque</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <SalesByCategoryChart data={salesByCategory} enableAnimations={preferences.enableChartAnimations} />
                <PaymentMethodChart data={salesByPaymentMethod} enableAnimations={preferences.enableChartAnimations} />
              </div>

              {!isMultiDay && (
                <HourlySalesChart data={hourlySales} enableAnimations={preferences.enableChartAnimations} />
              )}
            </TabsContent>

            {/* Sales Tab */}
            <TabsContent value="sales" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Dinheiro"
                  value={dailySummary.cashRevenue}
                  format="currency"
                />
                <MetricCard
                  title="Débito"
                  value={dailySummary.debitRevenue}
                  format="currency"
                />
                <MetricCard
                  title="Crédito"
                  value={dailySummary.creditRevenue}
                  format="currency"
                />
                <MetricCard
                  title="PIX"
                  value={dailySummary.pixRevenue}
                  format="currency"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <PaymentMethodChart data={salesByPaymentMethod} enableAnimations={preferences.enableChartAnimations} />
                {!isMultiDay && (
                  <HourlySalesChart data={hourlySales} enableAnimations={preferences.enableChartAnimations} />
                )}
              </div>
            </TabsContent>

            {/* Products Tab */}
            <TabsContent value="products" className="space-y-6">
              <SalesByCategoryChart data={salesByCategory} enableAnimations={preferences.enableChartAnimations} />
              <TopProductsTable data={topProducts} limit={10} />
            </TabsContent>

            {/* Stock Tab */}
            <TabsContent value="stock" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  title="Total de Alertas"
                  value={stockAlerts.length}
                  format="number"
                  icon={<Package className="h-4 w-4" />}
                />
                <MetricCard
                  title="Críticos"
                  value={stockAlerts.filter(a => a.status === 'critical').length}
                  format="number"
                  subtitle="Estoque zerado ou abaixo do mínimo"
                />
                <MetricCard
                  title="Baixos"
                  value={stockAlerts.filter(a => a.status === 'low').length}
                  format="number"
                  subtitle="Próximo ao estoque mínimo"
                />
              </div>

              <StockAlertsCard data={stockAlerts} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Actions Sidebar - Desktop only */}
        <div className="hidden lg:block">
          <ActionsSidebar
            onExportComplete={handleExportCompleteReport}
            onExportSummary={handleExportDailySummary}
            onExportCategories={handleExportSalesByCategory}
            onExportPayments={handleExportPaymentMethod}
            onExportTopProducts={handleExportTopProducts}
            onExportRevenueTrend={handleExportRevenueTrend}
            onExportStockAlerts={handleExportStockAlerts}
            onGenerateReservationsPDF={handleGenerateReservationsPDF}
            onGenerateStockPDF={handleGenerateStockPDF}
            onGenerateRestaurantPDF={handleGenerateRestaurantPDF}
            showRevenueTrend={isMultiDay && revenueTrend.length > 0}
            isExporting={isExporting}
            isGeneratingPDF={isGeneratingPDF}
          />
        </div>
      </div>
    </div>
  )
}
