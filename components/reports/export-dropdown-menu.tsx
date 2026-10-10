"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

interface ExportDropdownMenuProps {
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
  
  // Conditional visibility
  showRevenueTrend?: boolean
  
  // Loading states
  isExporting?: boolean
  isGeneratingPDF?: boolean
}

export function ExportDropdownMenu({
  onExportComplete,
  onExportSummary,
  onExportCategories,
  onExportPayments,
  onExportTopProducts,
  onExportRevenueTrend,
  onExportStockAlerts,
  onGenerateReservationsPDF,
  onGenerateStockPDF,
  showRevenueTrend = false,
  isExporting = false,
  isGeneratingPDF = false,
}: ExportDropdownMenuProps) {
  const isLoading = isExporting || isGeneratingPDF

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuLabel>Exportar Dados (CSV)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Complete Report */}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onExportComplete} disabled={isLoading}>
            <Package className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span className="font-medium">Relatório Completo</span>
              <span className="text-xs text-muted-foreground">
                Resumo + Categorias + Pagamentos + Produtos
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Exportações Específicas
        </DropdownMenuLabel>

        {/* Individual Exports */}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onExportSummary} disabled={isLoading}>
            <TrendingUp className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Resumo do Período</span>
              <span className="text-xs text-muted-foreground">
                Métricas principais
              </span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onExportCategories} disabled={isLoading}>
            <Package className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Vendas por Categoria</span>
              <span className="text-xs text-muted-foreground">
                Receita por categoria
              </span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onExportPayments} disabled={isLoading}>
            <CreditCard className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Formas de Pagamento</span>
              <span className="text-xs text-muted-foreground">
                Distribuição por método
              </span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onExportTopProducts} disabled={isLoading}>
            <Trophy className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Top Produtos</span>
              <span className="text-xs text-muted-foreground">
                Top 10 mais vendidos
              </span>
            </div>
          </DropdownMenuItem>

          {showRevenueTrend && (
            <DropdownMenuItem onClick={onExportRevenueTrend} disabled={isLoading}>
              <TrendingUp className="h-4 w-4 mr-2" />
              <div className="flex flex-col">
                <span>Tendência de Receita</span>
                <span className="text-xs text-muted-foreground">
                  Evolução diária
                </span>
              </div>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={onExportStockAlerts} disabled={isLoading}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Alertas de Estoque</span>
              <span className="text-xs text-muted-foreground">
                Produtos com estoque baixo
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Relatórios PDF</DropdownMenuLabel>

        {/* PDF Reports */}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onGenerateReservationsPDF} disabled={isLoading}>
            <FileText className="h-4 w-4 mr-2" />
            Reservas
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onGenerateStockPDF} disabled={isLoading}>
            <Package className="h-4 w-4 mr-2" />
            Estoque
          </DropdownMenuItem>

        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
