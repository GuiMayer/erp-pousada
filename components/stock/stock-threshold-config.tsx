"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useApp } from "@/lib/app-context"
import { useToast } from "@/hooks/use-toast"
import { getStockStatusLevel } from "@/lib/utils/stock-validation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Package, Save, Settings } from "lucide-react"
import type { StockItem } from "@/lib/store"

export function StockThresholdConfig() {
  const { posProducts, stockItems, updateStockItem, addAuditEntry } = useApp()
  const { username } = useAuth()
  const { toast } = useToast()
  const [editingItem, setEditingItem] = useState<StockItem | null>(null)
  const [minimumStock, setMinimumStock] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  function openEditDialog(item: StockItem) {
    setEditingItem(item)
    setMinimumStock(String(item.minimumStock))
    setDialogOpen(true)
  }

  function closeDialog() {
    setEditingItem(null)
    setMinimumStock("")
    setDialogOpen(false)
  }

  async function handleSave() {
    try {
    if (!editingItem) return

    const newMinimum = Number(minimumStock)
    if (isNaN(newMinimum) || newMinimum < 0) {
      toast({
        title: "Valor Inválido",
        description: "O estoque mínimo deve ser um número positivo",
        variant: "destructive",
      })
      return
    }

    const oldMinimum = editingItem.minimumStock

    await updateStockItem(editingItem.id, {
      recordVersion: editingItem.recordVersion,
      minimumStock: newMinimum,
    })

    addAuditEntry({
      action: "atualizar_threshold",
      user: username || "sistema",
      entityType: "StockItem",
      entityId: editingItem.id,
      reference: `Estoque mínimo alterado de ${oldMinimum} para ${newMinimum} ${editingItem.unit}`,
      metadata: {
        itemName: editingItem.productName,
        oldMinimum,
        newMinimum,
        unit: editingItem.unit,
      },
    })

    toast({
      title: "Threshold Atualizado",
      description: `Estoque mínimo de ${editingItem.productName} atualizado para ${newMinimum} ${editingItem.unit}`,
    })

    closeDialog()

    } catch (failure) { toast({ title: "Alteração não salva", description: failure instanceof Error ? failure.message : "Tente novamente", variant: "destructive" }) }
  }

  function getStatusBadge(status: "critical" | "low" | "warning" | "normal") {
    switch (status) {
      case "critical":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Crítico
          </Badge>
        )
      case "low":
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500">
            <AlertTriangle className="h-3 w-3" />
            Baixo
          </Badge>
        )
      case "warning":
        return (
          <Badge variant="secondary" className="gap-1 bg-orange-500/10 text-orange-600 dark:text-orange-500">
            <AlertTriangle className="h-3 w-3" />
            Atenção
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Package className="h-3 w-3" />
            Normal
          </Badge>
        )
    }
  }

  const sortedItems = [...stockItems].sort((a, b) => {
    const statusOrder = { critical: 0, low: 1, warning: 2, normal: 3 }
    const statusA = getStockStatusLevel(a)
    const statusB = getStockStatusLevel(b)

    if (statusOrder[statusA] !== statusOrder[statusB]) {
      return statusOrder[statusA] - statusOrder[statusB]
    }

    return a.productName.localeCompare(b.productName)
  })

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuração de Thresholds
              </CardTitle>
              <CardDescription>
                Defina os níveis mínimos de estoque para cada item
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Estoque Atual</TableHead>
                  <TableHead className="text-right">Estoque Mínimo</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum item de estoque cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map(item => {
                    const status = getStockStatusLevel(item)
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {item.productName}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {posProducts.find(p => p.id === item.productId)?.categoryId}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.currentStock} {item.unit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.minimumStock} {item.unit}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(item)}
                          >
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Estoque Mínimo</DialogTitle>
            <DialogDescription>
              Defina o nível mínimo de estoque para {editingItem?.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item</Label>
              <div className="text-sm font-medium">{editingItem?.productName}</div>
            </div>

            <div className="space-y-2">
              <Label>Estoque Atual</Label>
              <div className="text-sm text-muted-foreground">
                {editingItem?.currentStock} {editingItem?.unit}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-stock">
                Estoque Mínimo ({editingItem?.unit})
              </Label>
              <Input
                id="minimum-stock"
                type="number"
                min="0"
                step="1"
                value={minimumStock}
                onChange={e => setMinimumStock(e.target.value)}
                placeholder="Ex: 10"
              />
              <p className="text-xs text-muted-foreground">
                Você receberá alertas quando o estoque atingir este nível
              </p>
            </div>

            {editingItem && Number(minimumStock) > 0 && (
              <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
                <div className="text-sm font-medium">Níveis de Alerta:</div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="h-5">Crítico</Badge>
                    <span>≤ {minimumStock} {editingItem.unit}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-5 bg-yellow-500/10 text-yellow-600">
                      Baixo
                    </Badge>
                    <span>≤ {Math.ceil(Number(minimumStock) * 1.5)} {editingItem.unit}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
