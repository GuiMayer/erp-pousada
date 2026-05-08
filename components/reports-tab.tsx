"use client"

import { useState } from "react"
import { useReports } from "@/lib/hooks/useReports"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Download, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Users,
  Package,
} from "lucide-react"
import { MetricCard } from "./reports/metric-card"
import { SalesByCategoryChart } from "./reports/sales-by-category-chart"
import { PaymentMethodChart } from "./reports/payment-method-chart"
import { HourlySalesChart } from "./reports/hourly-sales-chart"
import { TopProductsTable } from "./reports/top-products-table"
import { StockAlertsCard } from "./reports/stock-alerts-card"
import { PeriodSelector } from "./reports/period-selector"
import { RevenueTrendChart } from "./reports/revenue-trend-chart"
import { 
  exportDailySummaryToCSV, 
  exportTopProductsToCSV,
  exportSalesByCategoryToCSV,
  exportPaymentMethodToCSV,
  exportRevenueTrendToCSV,
  exportStockAlertsToCSV,
  exportCompleteReport,
} from "@/lib/utils/csv-export"
import { getTodayISO } from "@/lib/utils/constants"

export function ReportsTab() {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [startDate, setStartDate] = useState(getTodayISO())
  const [endDate, setEndDate] = useState(getTodayISO())
  
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

  const handleExportDailySummary = () => {
    const dateLabel = isMultiDay ? `${startDate}_${endDate}` : startDate
    exportDailySummaryToCSV(dailySummary, dateLabel)
  }

  const handleExportTopProducts = () => {
    const dateLabel = isMultiDay ? `${startDate}_${endDate}` : startDate
    exportTopProductsToCSV(topProducts, dateLabel)
  }

  const handleExportSalesByCategory = () => {
    const dateLabel = isMultiDay ? `${startDate}_${endDate}` : startDate
    exportSalesByCategoryToCSV(salesByCategory, dateLabel)
  }

  const handleExportPaymentMethod = () => {
    const dateLabel = isMultiDay ? `${startDate}_${endDate}` : startDate
    exportPaymentMethodToCSV(salesByPaymentMethod, dateLabel)
  }

  const handleExportRevenueTrend = () => {
    const dateLabel = `${startDate}_${endDate}`
    exportRevenueTrendToCSV(revenueTrend, dateLabel)
  }

  const handleExportStockAlerts = () => {
    exportStockAlertsToCSV(stockAlerts)
  }

  const handleExportCompleteReport = () => {
    const dateLabel = isMultiDay ? `${startDate}_${endDate}` : startDate
    exportCompleteReport(
      dailySummary,
      salesByCategory,
      salesByPaymentMethod,
      topProducts,
      dateLabel
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Relatórios</h2>
            <p className="text-muted-foreground">
              Análise de vendas, estoque e desempenho
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportCompleteReport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Completo
            </Button>
            <Button variant="outline" onClick={handleExportDailySummary}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Resumo
            </Button>
          </div>
        </div>
        
        <PeriodSelector
          selectedPeriod={selectedPeriod}
          startDate={startDate}
          endDate={endDate}
          onPeriodChange={handlePeriodChange}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="sales">Vendas</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="stock">Estoque</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Receita Total"
              value={dailySummary.totalRevenue}
              format="currency"
              icon={<DollarSign className="h-4 w-4" />}
              trend={
                dailySummary.revenueChange !== undefined
                  ? {
                      value: dailySummary.revenueChange,
                      label: "vs ontem",
                    }
                  : undefined
              }
            />
            <MetricCard
              title="Vendas"
              value={dailySummary.totalSales}
              format="number"
              icon={<ShoppingCart className="h-4 w-4" />}
              subtitle={`${dailySummary.transactionCount} transações`}
            />
            <MetricCard
              title="Ticket Médio"
              value={dailySummary.averageTicket}
              format="currency"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              title="Alertas de Estoque"
              value={stockAlerts.length}
              format="number"
              icon={<Package className="h-4 w-4" />}
              subtitle={`${stockAlerts.filter(a => a.status === 'critical').length} críticos`}
            />
          </div>

          {/* Revenue Trend (only for multi-day periods) */}
          {isMultiDay && revenueTrend.length > 0 && (
            <div className="space-y-2">
              <RevenueTrendChart data={revenueTrend} />
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleExportRevenueTrend}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Tendência
                </Button>
              </div>
            </div>
          )}

          {/* Charts Row 1 */}
          <div className="grid gap-4 md:grid-cols-2">
            <SalesByCategoryChart data={salesByCategory} />
            <PaymentMethodChart data={salesByPaymentMethod} />
          </div>

          {/* Charts Row 2 */}
          <HourlySalesChart data={hourlySales} />
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-6">
          {/* Payment Method Breakdown */}
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
            <PaymentMethodChart data={salesByPaymentMethod} />
            <HourlySalesChart data={hourlySales} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleExportPaymentMethod}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Formas de Pagamento
            </Button>
            <Button variant="outline" onClick={handleExportSalesByCategory}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Vendas por Categoria
            </Button>
          </div>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          <SalesByCategoryChart data={salesByCategory} />
          
          <TopProductsTable data={topProducts} limit={10} />

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleExportTopProducts}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Top Produtos
            </Button>
          </div>
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

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleExportStockAlerts}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Alertas de Estoque
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
