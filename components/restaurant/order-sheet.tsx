"use client"
import { PermissionGate } from "@/components/permission-gate"

import { getDataConfig } from "@/lib/data/config"

import { BankAccountPicker } from "../payment-fields"
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
import { useStockIntegration } from "@/lib/hooks/useStockIntegration"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { PAYMENT_METHODS } from "@/lib/store"
import type { RestaurantTable, POSProduct } from "@/lib/store"
import { cn } from "@/lib/utils"

interface OrderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: RestaurantTable | null
  onClose: () => void
  onPaid: (table: RestaurantTable, orderId: string) => void | Promise<void>
  onCanceled: (table: RestaurantTable, orderId: string) => void | Promise<void>
  onFirstItemAdded: (table: RestaurantTable, orderId: string) => void | Promise<void>
}

export function OrderSheet({ open, onOpenChange, table, onClose, onPaid, onCanceled, onFirstItemAdded }: OrderSheetProps) {
  const { posProducts, productCategories } = useApp()
  const { username } = useAuth()
  const { toast } = useToast()
  const orderId = table?.currentOrderId
  const { order, totals, addItem, removeItem, updateItemQuantity, applyDiscount, closeOrder, cancelOrder } = useOrderManagement(orderId)
  const { processStockForRestaurantOrder, rollbackStock } = useStockIntegration()

  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [quantity, setQuantity] = useState(1)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [paymentAccountId, setPaymentAccountId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [amountPaid, setAmountPaid] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  if (!table) return null

  const handleAddItem = async () => {
    if (!selectedProduct || !orderId) return
    const product = posProducts.find(p => p.id === selectedProduct)
    if (!product) return

    const wasEmpty = !order || order.items.length === 0
    await addItem(product, quantity)
    if (wasEmpty && table.status === "livre") {
      await onFirstItemAdded(table, orderId)
    }
    setSelectedProduct("")
    setQuantity(1)
  }

  const handleApplyDiscount = () => {
    applyDiscount(discountPercent)
  }

  const handleCloseOrder = async () => {
    if (!table || !orderId || !paymentMethod || !amountPaid) return

    const paid = parseFloat(amountPaid)
    if (isNaN(paid) || paid < totals.total) return

    if (!order) return

    const operator = username || "sistema"
    const stockResult = getDataConfig().adapter === "database" ? { success: true, movementIds: [] } : await processStockForRestaurantOrder(
      order.items,
      operator,
      `Comanda restaurante ${order.id} - Mesa ${table.number}`
    )
    if (!stockResult.success) {
      toast({
        title: "Pagamento bloqueado",
        description: stockResult.error || "Nao foi possivel baixar o estoque da comanda.",
        variant: "destructive",
      })
      return
    }

    const result = await closeOrder(paymentMethod, paid, customerName || undefined, operator, paymentMethod.toLowerCase() === "dinheiro" ? undefined : paymentAccountId || undefined)
    if (!result.success) {
      if (stockResult.movementIds?.length) {
        await rollbackStock(stockResult.movementIds, operator)
      }
      toast({
        title: "Pagamento bloqueado",
        description: result.error || "Nao foi possivel fechar a comanda.",
        variant: "destructive",
      })
      return
    }

    setShowCloseDialog(false)
    await onPaid(table, orderId)
  }

  const handleCancelOrder = async () => {
    if (!table || !orderId) return

    const result = await cancelOrder(cancelReason, username || "sistema")
    if (!result.success) {
      toast({
        title: "Cancelamento bloqueado",
        description: result.error || "Nao foi possivel cancelar a comanda.",
        variant: "destructive",
      })
      return
    }

    setCancelReason("")
    setShowCancelDialog(false)
    await onCanceled(table, orderId)
  }

  const restaurantCategoryIds = new Set(
    productCategories
      .filter(category => category.active && category.isRestaurant)
      .map(category => category.id)
  )

  const restaurantProducts = posProducts.filter(product =>
    restaurantCategoryIds.has(product.categoryId)
  )

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent data-mobile-order="" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Mesa {table.number}</SheetTitle>
            <SheetDescription>
              Gerencie os itens da comanda
            </SheetDescription>
          </SheetHeader>

          <div className="mobile-order-body flex flex-col h-[calc(100vh-8rem)] mt-6">
            {/* Add Item Section */}
            <div className="space-y-4 pb-4 border-b">
              <div className="mobile-order-add grid grid-cols-[1fr_auto_auto] gap-2">
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
                  <PermissionGate permission="restaurant.edit"><Button aria-label="Adicionar produto à comanda" onClick={handleAddItem} disabled={!selectedProduct}>
                    <Plus className="h-4 w-4" />
                  </Button></PermissionGate>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <ScrollArea className="mobile-order-items flex-1 py-4">
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
                      className="mobile-order-item flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-sm text-muted-foreground">
                          R$ {item.unitPrice.toFixed(2)} x {item.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <PermissionGate permission="restaurant.edit"><Button
                          size="icon"
                          variant="outline"
                          aria-label={`Diminuir quantidade de ${item.productName}`}
                          onClick={() => updateItemQuantity(item.id, Math.max(1, item.quantity - 1))}
                        >
                          <Minus className="h-4 w-4" />
                        </Button></PermissionGate>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <PermissionGate permission="restaurant.edit"><Button
                          size="icon"
                          variant="outline"
                          aria-label={`Aumentar quantidade de ${item.productName}`}
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button></PermissionGate>
                        <PermissionGate permission="restaurant.edit"><Button
                          size="icon"
                          variant="destructive"
                          aria-label={`Remover ${item.productName}`}
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button></PermissionGate>
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
                  <PermissionGate permission="restaurant.edit"><Button onClick={handleApplyDiscount} variant="outline">
                    <Percent className="h-4 w-4 mr-2" />
                    Aplicar
                  </Button></PermissionGate>
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
                  <PermissionGate permission="restaurant.cancel" approval><Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancelar
                  </Button></PermissionGate>
                  <PermissionGate permission="restaurant.receive"><Button
                    className="flex-1"
                    onClick={() => setShowCloseDialog(true)}
                  >
                    Fechar Comanda
                  </Button></PermissionGate>
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
              <BankAccountPicker method={paymentMethod} accountId={paymentAccountId} setAccountId={setPaymentAccountId} />
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
        description={
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe o motivo do cancelamento. Esta ação não pode ser desfeita.
            </p>
            <div>
              <Label htmlFor="cancel-reason">Motivo *</Label>
              <Input
                id="cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Ex.: pedido lançado incorretamente"
              />
            </div>
          </div>
        }
        confirmLabel="Sim, Cancelar"
        variant="destructive"
        onConfirm={handleCancelOrder}
      />
    </>
  )
}
