"use client"

import { useState } from "react"
import { Package, Plus, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { StockMovementModal } from "./stock-movement-modal"
import { useStockControl } from "@/lib/hooks/useStockControl"
import type { StockItem } from "@/lib/store"
import { cn } from "@/lib/utils"

export function StockTab() {
  const { stockItems, filter, setFilter, stats, getStockStatus } = useStockControl()
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [movementModalOpen, setMovementModalOpen] = useState(false)

  const handleAddMovement = (item: StockItem) => {
    setSelectedItem(item)
    setMovementModalOpen(true)
  }

  const getStatusBadge = (item: StockItem) => {
    const status = getStockStatus(item)
    
    if (status === "critical") {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Crítico
        </Badge>
      )
    }
    
    if (status === "low") {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-200">
          <TrendingDown className="h-3 w-3 mr-1" />
          Baixo
        </Badge>
      )
    }
    
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">
        <TrendingUp className="h-3 w-3 mr-1" />
        OK
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-8 w-8" />
            Controle de Estoque
          </h2>
          <p className="text-muted-foreground">
            Gerencie o estoque de produtos e insumos
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Total de Itens</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Estoque Crítico</div>
          <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Estoque Baixo</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.low}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Estoque OK</div>
          <div className="text-2xl font-bold text-green-600">{stats.ok}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Itens</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="low">Baixo</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stock Table */}
      {stockItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum item no estoque"
          description="Não há itens cadastrados ou nenhum item corresponde ao filtro selecionado."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Estoque Atual</TableHead>
                <TableHead>Estoque Mínimo</TableHead>
                <TableHead>Estoque Máximo</TableHead>
                <TableHead>Custo Médio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockItems.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "font-semibold",
                      getStockStatus(item) === "critical" && "text-red-600",
                      getStockStatus(item) === "low" && "text-yellow-600"
                    )}>
                      {item.currentStock} {item.unit}
                    </span>
                  </TableCell>
                  <TableCell>{item.minimumStock} {item.unit}</TableCell>
                  <TableCell>{item.maximumStock} {item.unit}</TableCell>
                  <TableCell>R$ {item.averageCost.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(item)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddMovement(item)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Movimentar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Stock Movement Modal */}
      <StockMovementModal
        open={movementModalOpen}
        onOpenChange={setMovementModalOpen}
        stockItem={selectedItem}
      />
    </div>
  )
}
