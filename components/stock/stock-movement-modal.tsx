"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStockControl } from "@/lib/hooks/useStockControl"
import { MOVEMENT_TYPES } from "@/lib/store"
import type { StockItem, MovementType } from "@/lib/store"

interface StockMovementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stockItem: StockItem | null
}

export function StockMovementModal({ open, onOpenChange, stockItem }: StockMovementModalProps) {
  const { registerMovement, validateMovement } = useStockControl()

  const [type, setType] = useState<MovementType>("entrada")
  const [quantity, setQuantity] = useState("")
  const [cost, setCost] = useState("")
  const [reason, setReason] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [expirationDate, setExpirationDate] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!stockItem) return

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      setError("Quantidade inválida")
      return
    }

    // Validate movement
    const validation = validateMovement(type, stockItem.productId, qty)
    if (!validation.valid) {
      setError(validation.error || "Erro na validação")
      return
    }

    const costValue = cost ? parseFloat(cost) : undefined
    if (cost && (isNaN(costValue!) || costValue! < 0)) {
      setError("Custo inválido")
      return
    }

    // Register movement
    const result = await registerMovement(
      type,
      stockItem.productId,
      qty,
      reason || getDefaultReason(type),
      "operador",
      costValue,
      invoiceNumber || undefined,
      expirationDate || undefined,
      notes || undefined
    )

    if (!result.success) { setError(result.error || "Movimento não concluído"); return }
    // Reset form
    resetForm()
    onOpenChange(false)
  }

  const resetForm = () => {
    setType("entrada")
    setQuantity("")
    setCost("")
    setReason("")
    setInvoiceNumber("")
    setExpirationDate("")
    setNotes("")
    setError("")
  }

  const getDefaultReason = (movementType: MovementType): string => {
    switch (movementType) {
      case "entrada":
        return "Compra de estoque"
      case "saida":
        return "Venda/Consumo"
      case "ajuste":
        return "Ajuste de inventário"
      case "perda":
        return "Perda/Vencimento"
      default:
        return ""
    }
  }

  const getMovementLabel = (movementType: MovementType): string => {
    switch (movementType) {
      case "entrada":
        return "Entrada"
      case "saida":
        return "Saída"
      case "ajuste":
        return "Ajuste"
      case "perda":
        return "Perda"
      default:
        return movementType
    }
  }

  if (!stockItem) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mobileTask protectDraft className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Movimentar Estoque
          </DialogTitle>
          <DialogDescription>
            {stockItem.productName} - Estoque atual: {stockItem.currentStock} {stockItem.unit}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Tipo de Movimentação</Label>
              <Select value={type} onValueChange={(value: MovementType) => setType(value)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>
                      {getMovementLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="quantity">
                Quantidade ({stockItem.unit})
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value)
                  setError("")
                }}
                placeholder="0.00"
              />
            </div>
          </div>

          {type === "entrada" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cost">Custo Unitário (R$)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="invoice">Nota Fiscal</Label>
                  <Input
                    id="invoice"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="NF-123456"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="expiration">Data de Validade</Label>
                <Input
                  id="expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="reason">Motivo</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={getDefaultReason(type)}
            />
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            Registrar Movimentação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
