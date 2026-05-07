"use client"

import { useState } from "react"
import { X, Plus, Minus, Trash2, DollarSign, Percent } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { useOrderManagement } from "@/lib/hooks/useOrderManagement"
import { useApp } from "@/lib/app-context"
import { PAYMENT_METHODS } from "@/lib/store"
import type { RestaurantTable, POSProduct } from "@/lib/store"
import { cn } from "@/lib/utils"

interface OrderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: RestaurantTable | null
  onClose: () => void
}

export function OrderSheet({ open, onOpenChange, table, onClose }: OrderSheetProps) {
  const { posProducts } = useApp()
  const orderId = table?.currentOrderId
  const { order, totals, addItem, removeItem, updateItemQuantity, applyDiscount, closeOrder, cancelOrder } = useOrderManagement(orderId)
  
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [quantity, setQuantity] = useState(1)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [amountPaid, setAmountPaid] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  if (!table) return null

  const handleAddItem = () => {
    if (!selectedProduct) return
    const product = posProducts.find(p => p.id === selectedProduct)
    if (!product) return

    addItem(product, quantity)
    setSelectedProduct("")
    setQuantity(1)
  }

  const handleApplyDiscount = () => {
    applyDiscount(discountPercent)
  }

  const handleCloseOrder = () => {
    if (!paymentMethod || !amountPaid) return
    
    const paid = parseFloat(amountPaid)
    if (isNaN(paid) || paid < totals.total) return

    closeOrder(paymentMethod, paid, customerName || undefined)
    setShowCloseDialog(false)
    onClose()
  }

  const handleCancelOrder = () => {
    cancelOrder("Cancelada pelo operador")
    setShowCancelDialog(false)
    onClose()
  }

  const restaurantProducts = posProducts.filter(p => 
    ["Bebidas", "Lanches", "Doces", "Refeicoes"].includes(p.category)
  )

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Mesa {table.number}</SheetTitle>
            <SheetDescription>
              Gerencie os itens da comanda
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col h-[calc(100vh-8rem)] mt-6">
            {/* Add Item Section */}
            <div className="space-y-4 pb-4 border-b">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <div>
                  <Label htmlFor="product">Produto</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger id="product">
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurantProducts.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - R$ {product.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label htmlFor="quantity">Qtd</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddItem} disabled={!selectedProduct}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <ScrollArea className="flex-1 py-4">
              {!order || order.items.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  title="Comanda vazia"
                  description="Adicione produtos para começar a comanda"
                />
              ) : (
                <div className="space-y-2">
                  {order.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-sm text-muted-foreground">
                          R$ {item.unitPrice.toFixed(2)} x {item.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => updateItemQuantity(item.id, Math.max(1, item.quantity - 1))}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="font-semibold w-24 text-right">
                        R$ {item.subtotal.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Totals and Actions */}
            {order && order.items.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                {/* Discount */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="discount">Desconto (%)</Label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      max="100"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <Button onClick={handleApplyDiscount} variant="outline">
                    <Percent className="h-4 w-4 mr-2" />
                    Aplicar
                  </Button>
                </div>

                <Separator />

                {/* Summary */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>R$ {totals.subtotal.toFixed(2)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Desconto:</span>
                      <span>- R$ {totals.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>R$ {totals.total.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => setShowCloseDialog(true)}
                  >
                    Fechar Comanda
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Close Order Dialog */}
      <ConfirmationDialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        title="Fechar Comanda"
        description={
          <div className="space-y-4">
            <div>
              <Label htmlFor="payment-method">Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(method => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount-paid">Valor Pago</Label>
              <Input
                id="amount-paid"
                type="number"
                step="0.01"
                min={totals.total}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={`Mínimo: R$ ${totals.total.toFixed(2)}`}
              />
            </div>
            <div>
              <Label htmlFor="customer-name">Cliente (opcional)</Label>
              <Input
                id="customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            {amountPaid && parseFloat(amountPaid) >= totals.total && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between font-medium">
                  <span>Troco:</span>
                  <span>R$ {(parseFloat(amountPaid) - totals.total).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        }
        confirmLabel="Confirmar Pagamento"
        onConfirm={handleCloseOrder}
      />

      {/* Cancel Order Dialog */}
      <ConfirmationDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="Cancelar Comanda"
        description="Tem certeza que deseja cancelar esta comanda? Esta ação não pode ser desfeita."
        confirmLabel="Sim, Cancelar"
        variant="destructive"
        onConfirm={handleCancelOrder}
      />
    </>
  )
}
