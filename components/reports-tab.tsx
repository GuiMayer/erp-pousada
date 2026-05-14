/**
 * Unified Reports Tab Component
 * 
 * Combines interactive analytics charts with PDF report generation.
 * - Analytics tab: Real-time charts and visualizations
 * - PDF Reports tab: Formal document generation
 */

"use client"

import { useState } from "react"
import { useReports } from "@/lib/hooks/useReports"
import { useUserPreferences } from "@/contexts/user-preferences-context"
import { useApp } from "@/lib/app-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Download, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart,
  Package,
  BarChart3,
  FileText,
} from "lucide-react"
import { MetricCard } from "./reports/metric-card"
import { SalesByCategoryChart } from "./reports/sales-by-category-chart"
import { PaymentMethodChart } from "./reports/payment-method-chart"
import { HourlySalesChart } from "./reports/hourly-sales-chart"
import { TopProductsTable } from "./reports/top-products-table"
import { StockAlertsCard } from "./reports/stock-alerts-card"
import { PeriodSelector } from "./reports/period-selector"
import { RevenueTrendChart } from "./reports/revenue-trend-chart"
import { PeriodComparisonCard } from "./reports/period-comparison-card"
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

  // Shared period state
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [startDate, setStartDate] = useState(getTodayISO())
  const [endDate, setEndDate] = useState(getTodayISO())
  
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

  // Period comparison data
  const getPeriodLabel = () => {
    if (selectedPeriod === 'today') return 'Hoje'
    if (selectedPeriod === 'week') return 'Esta Semana'
    if (selectedPeriod === 'month') return 'Este Mês'
    return 'Período Atual'
  }

  const getPreviousPeriodLabel = () => {
    if (selectedPeriod === 'today') return 'Ontem'
    if (selectedPeriod === 'week') return 'Semana Anterior'
    if (selectedPeriod === 'month') return 'Mês Anterior'
    return 'Período Anterior'
  }

  const periodComparison = {
    currentPeriod: {
      label: getPeriodLabel(),
      revenue: dailySummary.totalRevenue,
      transactions: dailySummary.transactionCount,
      averageTicket: dailySummary.averageTicket,
    },
    previousPeriod: {
      label: getPreviousPeriodLabel(),
      revenue: dailySummary.previousDayRevenue,
      transactions: 0,
      averageTicket: 0,
    },
  }

  // CSV Export handlers
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

  // PDF Report handlers
  const handleGenerateReservationsReport = () => {
    try {
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
    } catch (error) {
      console.error("Error generating reservations report:", error)
      toast.error("Erro ao gerar relatório de reservas")
    }
  }

  const handleGenerateStockReport = () => {
    try {
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
    } catch (error) {
      console.error("Error generating stock report:", error)
      toast.error("Erro ao gerar relatório de estoque")
    }
  }

  const handleGenerateRestaurantReport = () => {
    try {
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
    } catch (error) {
      console.error("Error generating restaurant report:", error)
      toast.error("Erro ao gerar relatório de restaurante")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Relatórios</h2>
            <p className="text-muted-foreground">
              Análise de vendas, estoque e geração de relatórios PDF
            </p>
          </div>
        </div>
        
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
            <div className="mt-0.5">💡</div>
            <div>
              <strong>Período compartilhado:</strong> O período selecionado abaixo é aplicado automaticamente aos gráficos de análise e aos relatórios PDF.
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
      </div>

      {/* Main Tabs: Analytics vs PDF Reports */}
      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="analytics" className="gap-2" title="Visualize dados em tempo real com gráficos interativos">
            <BarChart3 className="h-4 w-4" />
            Análise
          </TabsTrigger>
          <TabsTrigger value="pdf-reports" className="gap-2" title="Gere documentos formais em PDF para impressão e arquivo">
            <FileText className="h-4 w-4" />
            Relatórios PDF
          </TabsTrigger>
        </TabsList>

        {/* Analytics Tab - Interactive Charts */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={handleExportCompleteReport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Completo (CSV)
            </Button>
            <Button variant="outline" onClick={handleExportDailySummary}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Resumo (CSV)
            </Button>
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

              {/* Period Comparison (only for multi-day periods) */}
              {isMultiDay && (
                <PeriodComparisonCard
                  currentPeriod={periodComparison.currentPeriod}
                  previousPeriod={periodComparison.previousPeriod}
                />
              )}

              {/* Revenue Trend (only for multi-day periods) */}
              {isMultiDay && revenueTrend.length > 0 && (
                <div className="space-y-2">
                  <RevenueTrendChart data={revenueTrend} enableAnimations={preferences.enableChartAnimations} />
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
                <SalesByCategoryChart data={salesByCategory} enableAnimations={preferences.enableChartAnimations} />
                <PaymentMethodChart data={salesByPaymentMethod} enableAnimations={preferences.enableChartAnimations} />
              </div>

              {/* Charts Row 2 */}
              <HourlySalesChart data={hourlySales} enableAnimations={preferences.enableChartAnimations} />
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
                <PaymentMethodChart data={salesByPaymentMethod} enableAnimations={preferences.enableChartAnimations} />
                <HourlySalesChart data={hourlySales} enableAnimations={preferences.enableChartAnimations} />
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
              <SalesByCategoryChart data={salesByCategory} enableAnimations={preferences.enableChartAnimations} />
              
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
        </TabsContent>

        {/* PDF Reports Tab */}
        <TabsContent value="pdf-reports" className="space-y-6">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" />
              Relatórios PDF - Documentação Formal
            </div>
            <p className="text-sm text-muted-foreground">
              Gere relatórios em PDF para documentação formal e arquivo. O período selecionado acima ({getPeriodLabel()}: {startDate === endDate ? startDate : `${startDate} a ${endDate}`}) será aplicado aos relatórios de Reservas e Restaurante.
            </p>
          </div>

          {/* Reservations Report */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatório de Reservas
              </CardTitle>
              <CardDescription>
                Gere um relatório detalhado das reservas com estatísticas e análises
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reservation-status">Status</Label>
                  <Select value={reservationStatus} onValueChange={(value) => setReservationStatus(value as any)}>
                    <SelectTrigger id="reservation-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="confirmed">Confirmada</SelectItem>
                      <SelectItem value="checkedIn">Check-in</SelectItem>
                      <SelectItem value="checkedOut">Check-out</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reservation-room">Quarto</Label>
                  <Select value={reservationRoomId} onValueChange={setReservationRoomId}>
                    <SelectTrigger id="reservation-room">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleGenerateReservationsReport} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Gerar Relatório de Reservas (PDF)
              </Button>
            </CardContent>
          </Card>

          {/* Stock Report */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatório de Estoque
              </CardTitle>
              <CardDescription>
                Gere um relatório detalhado do estoque com análises de valor e categorias
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock-category">Categoria</Label>
                  <Select value={stockCategoryId} onValueChange={setStockCategoryId}>
                    <SelectTrigger id="stock-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {productCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock-type">Tipo</Label>
                  <Select value={stockType} onValueChange={(value) => setStockType(value as any)}>
                    <SelectTrigger id="stock-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="consumable">Consumível</SelectItem>
                      <SelectItem value="sellable">Vendável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="stock-low-stock"
                  checked={stockLowStock}
                  onCheckedChange={(checked) => setStockLowStock(checked as boolean)}
                />
                <Label htmlFor="stock-low-stock" className="cursor-pointer">
                  Apenas produtos com estoque baixo
                </Label>
              </div>
              <Button onClick={handleGenerateStockReport} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Gerar Relatório de Estoque (PDF)
              </Button>
            </CardContent>
          </Card>

          {/* Restaurant Report */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatório de Restaurante
              </CardTitle>
              <CardDescription>
                Gere um relatório detalhado dos pedidos do restaurante com análises de vendas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="restaurant-status">Status</Label>
                  <Select value={restaurantStatus} onValueChange={(value) => setRestaurantStatus(value as any)}>
                    <SelectTrigger id="restaurant-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="preparing">Preparando</SelectItem>
                      <SelectItem value="ready">Pronto</SelectItem>
                      <SelectItem value="delivered">Entregue</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="restaurant-category">Categoria</Label>
                  <Select value={restaurantCategoryId} onValueChange={setRestaurantCategoryId}>
                    <SelectTrigger id="restaurant-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {productCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleGenerateRestaurantReport} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Gerar Relatório de Restaurante (PDF)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
