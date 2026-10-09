"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Download,
  FileText,
  Loader2,
  Package,
  TrendingUp,
  DollarSign,
  CreditCard,
  Trophy,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ActionsSidebarProps {
  // CSV Export handlers
  onExportComplete: () => void
  onExportSummary: () => void
  onExportCategories: () => void
  onExportPayments: () => void
  onExportTopProducts: () => void
  onExportRevenueTrend: () => void
  onExportStockAlerts: () => void

  // PDF Report handlers
  onGenerateReservationsPDF: () => void
  onGenerateStockPDF: () => void
  onGenerateRestaurantPDF: () => void

  // Conditional visibility
  showRevenueTrend?: boolean

  // Loading states
  isExporting?: boolean
  isGeneratingPDF?: boolean
}

export function ActionsSidebar({
  onExportComplete,
  onExportSummary,
  onExportCategories,
  onExportPayments,
  onExportTopProducts,
  onExportRevenueTrend,
  onExportStockAlerts,
  onGenerateReservationsPDF,
  onGenerateStockPDF,
  onGenerateRestaurantPDF,
  showRevenueTrend = false,
  isExporting = false,
  isGeneratingPDF = false,
}: ActionsSidebarProps) {
  const [selectedExports, setSelectedExports] = useState<string[]>([])

  const toggleExport = (exportId: string) => {
    setSelectedExports(prev =>
      prev.includes(exportId)
        ? prev.filter(id => id !== exportId)
        : [...prev, exportId]
    )
  }

  const handleExportSelected = () => {
    if (selectedExports.length === 0) return

    selectedExports.forEach(exportId => {
      switch (exportId) {
        case 'summary':
          onExportSummary()
          break
        case 'categories':
          onExportCategories()
          break
        case 'payments':
          onExportPayments()
          break
        case 'products':
          onExportTopProducts()
          break
        case 'trend':
          onExportRevenueTrend()
          break
        case 'stock':
          onExportStockAlerts()
          break
      }
    })

    setSelectedExports([])
  }

  const exportOptions = [
    { id: 'summary', label: 'Resumo do Período', icon: TrendingUp, description: 'Métricas principais e totalizadores' },
    { id: 'categories', label: 'Vendas por Categoria', icon: Package, description: 'Receita detalhada por categoria' },
    { id: 'payments', label: 'Formas de Pagamento', icon: CreditCard, description: 'Distribuição por método de pagamento' },
    { id: 'products', label: 'Top Produtos', icon: Trophy, description: 'Top 10 produtos mais vendidos' },
    ...(showRevenueTrend ? [{ id: 'trend', label: 'Tendência de Receita', icon: TrendingUp, description: 'Evolução diária da receita' }] : []),
    { id: 'stock', label: 'Alertas de Estoque', icon: AlertTriangle, description: 'Produtos com estoque baixo ou crítico' },
  ]

  return (
    <div className="w-full lg:w-80 xl:w-96 space-y-4 lg:sticky lg:top-6">
      {/* CSV Exports Section */}
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar Dados (CSV)
          </CardTitle>
          <CardDescription className="text-xs">
            Selecione os dados que deseja exportar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Quick Export All */}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onExportComplete}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exportar Tudo
          </Button>

          <Separator />

          {/* Individual Export Options */}
          <div className="space-y-2">
            {exportOptions.map((option) => {
              const Icon = option.icon
              return (
                <div key={option.id} className="flex items-start space-x-2">
                  <Checkbox
                    id={option.id}
                    checked={selectedExports.includes(option.id)}
                    onCheckedChange={() => toggleExport(option.id)}
                    disabled={isExporting}
                  />
                  <div className="grid gap-0.5 leading-none flex-1">
                    <Label
                      htmlFor={option.id}
                      className={cn(
                        "text-sm font-medium cursor-pointer flex items-center gap-1.5",
                        isExporting && "opacity-50"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Export Selected Button */}
          {selectedExports.length > 0 && (
            <>
              <Separator />
              <Button
                size="sm"
                className="w-full"
                onClick={handleExportSelected}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Exportar Selecionados ({selectedExports.length})
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* PDF Reports Section */}
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatórios PDF
          </CardTitle>
          <CardDescription className="text-xs">
            Gere documentos formais para impressão
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onGenerateReservationsPDF}
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Reservas
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onGenerateStockPDF}
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Package className="h-4 w-4 mr-2" />
            )}
            Estoque
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onGenerateRestaurantPDF}
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4 mr-2" />
            )}
            Restaurante
          </Button>

          <div className="pt-2 text-xs text-muted-foreground">
            Os PDFs usam o período selecionado no filtro acima
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
