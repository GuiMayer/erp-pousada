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
import { 
  exportDailySummaryToCSV, 
  exportTopProductsToCSV,
  exportSalesByCategoryToCSV,
} from "@/lib/utils/csv-export"
import { getTodayISO } from "@/lib/utils/constants"

export function ReportsTab() {
  const [selectedDate, setSelectedDate] = useState(getTodayISO())
  
  const {
    getDailySummary,
    getSalesByCategory,
    getSalesByPaymentMethod,
    getTopProducts,
    getHourlySales,
    getStockAlerts,
  } = useReports()

  // Get data for selected date
  const dailySummary = getDailySummary(selectedDate)
  const salesByCategory = getSalesByCategory(selectedDate)
  const salesByPaymentMethod = getSalesByPaymentMethod(selectedDate)
  const topProducts = getTopProducts(selectedDate, 10)
  const hourlySales = getHourlySales(selectedDate)
  const stockAlerts = getStockAlerts()

  const handleExportDailySummary = () => {
    exportDailySummaryToCSV(dailySummary, selectedDate)
  }

  const handleExportTopProducts = () => {
    exportTopProductsToCSV(topProducts, selectedDate)
  }

  const handleExportSalesByCategory = () => {
    exportSalesByCategoryToCSV(salesByCategory, selectedDate)
  }

  return (
    <div className="space-y-6">
      {/* Header with date selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Relatórios</h2>
          <p className="text-muted-foreground">
            Análise de vendas, estoque e desempenho
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="report-date">Data:</Label>
            <Input
              id="report-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <Button variant="outline" onClick={handleExportDailySummary}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
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

          <div className="flex justify-end">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
