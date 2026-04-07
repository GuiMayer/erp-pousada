"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Banknote, QrCode, Receipt, X, Percent, User, Barcode,
  Clock, CheckCircle2, XCircle, History, Package, Settings, Pencil,
} from "lucide-react"
import type { POSProduct, POSCartItem, POSSale } from "@/lib/store"

const PAYMENT_METHODS = [
  { id: "dinheiro", label: "Dinheiro", icon: Banknote },
  { id: "cartao_debito", label: "Cartao Debito", icon: CreditCard },
  { id: "cartao_credito", label: "Cartao Credito", icon: CreditCard },
  { id: "pix", label: "PIX", icon: QrCode },
]

export function POSTab() {
  const {
    posProducts, posSales, rooms,
    addPOSSale, updatePOSSale, addTransaction, addAuditEntry,
    addPOSProduct, updatePOSProduct, removePOSProduct,
  } = useApp()
  const { username, role } = useAuth()

  // Cart state
  const [cart, setCart] = useState<POSCartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [barcodeInput, setBarcodeInput] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("Todos")
  const [globalDiscount, setGlobalDiscount] = useState(0)
  const [customer, setCustomer] = useState("")

  // Payment modal
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("dinheiro")
  const [amountPaid, setAmountPaid] = useState("")

  // Receipt modal
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [lastSale, setLastSale] = useState<POSSale | null>(null)

  // Sales history sheet
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<POSSale | null>(null)

  // Cancel sale modal
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [saleToCancel, setSaleToCancel] = useState<POSSale | null>(null)
  const [supervisorPassword, setSupervisorPassword] = useState("")

  // Item discount modal
  const [itemDiscountOpen, setItemDiscountOpen] = useState(false)
  const [itemToDiscount, setItemToDiscount] = useState<POSCartItem | null>(null)
  const [itemDiscountValue, setItemDiscountValue] = useState("")

  // Product management modal
  const [manageProductsOpen, setManageProductsOpen] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<POSProduct | null>(null)
  const [productForm, setProductForm] = useState({ name: "", category: "", price: "", barcode: "" })
  const [productSearch, setProductSearch] = useState("")
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<POSProduct | null>(null)

  const barcodeRef = useRef<HTMLInputElement>(null)

  // Categories
  const categories = useMemo(() => {
    const cats = new Set(posProducts.map(p => p.category))
    return ["Todos", ...Array.from(cats)]
  }, [posProducts])

  // Filtered products
  const filteredProducts = useMemo(() => {
    return posProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery))
      const matchesCategory = categoryFilter === "Todos" || p.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [posProducts, searchQuery, categoryFilter])

  // Cart calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const itemTotal = item.product.price * item.quantity
      const itemDiscount = itemTotal * (item.discount / 100)
      return sum + (itemTotal - itemDiscount)
    }, 0)
  }, [cart])

  const discountAmount = subtotal * (globalDiscount / 100)
  const total = subtotal - discountAmount

  // Today's sales
  const todaySales = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    return posSales.filter(s => s.date.startsWith(today) && s.status === "concluida")
  }, [posSales])

  const todayTotal = useMemo(() => {
    return todaySales.reduce((sum, s) => sum + s.total, 0)
  }, [todaySales])

  // Occupied rooms for customer selection
  const occupiedRooms = useMemo(() => {
    return rooms.filter(r => r.status === "ocupado" && r.guest)
  }, [rooms])

  // Handle barcode scan
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault()
        barcodeRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const product = posProducts.find(p => p.barcode === barcodeInput)
    if (product) {
      addToCart(product)
    }
    setBarcodeInput("")
    barcodeRef.current?.focus()
  }

  function addToCart(product: POSProduct) {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, {
        id: `CI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product,
        quantity: 1,
        discount: 0,
      }]
    })
  }

  function updateQuantity(itemId: string, delta: number) {
    setCart(prev =>
      prev.map(item => {
        if (item.id === itemId) {
          const newQty = Math.max(0, item.quantity + delta)
          return { ...item, quantity: newQty }
        }
        return item
      }).filter(item => item.quantity > 0)
    )
  }

  function removeFromCart(itemId: string) {
    setCart(prev => prev.filter(item => item.id !== itemId))
  }

  function clearCart() {
    setCart([])
    setGlobalDiscount(0)
    setCustomer("")
  }

  function openItemDiscount(item: POSCartItem) {
    setItemToDiscount(item)
    setItemDiscountValue(String(item.discount))
    setItemDiscountOpen(true)
  }

  function applyItemDiscount() {
    if (!itemToDiscount) return
    const discount = Math.min(100, Math.max(0, Number(itemDiscountValue) || 0))
    setCart(prev =>
      prev.map(item =>
        item.id === itemToDiscount.id
          ? { ...item, discount }
          : item
      )
    )
    setItemDiscountOpen(false)
    setItemToDiscount(null)
    setItemDiscountValue("")
  }

  function openPayment() {
    if (cart.length === 0) return
    setPaymentMethod("dinheiro")
    setAmountPaid("")
    setPaymentOpen(true)
  }

  function calculateChange(): number {
    if (paymentMethod !== "dinheiro") return 0
    const paid = Number(amountPaid) || 0
    return Math.max(0, paid - total)
  }

  function finalizeSale() {
    const paid = Number(amountPaid) || total
    if (paymentMethod === "dinheiro" && paid < total) return

    const sale: POSSale = {
      id: `V${String(posSales.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString(),
      items: cart,
      subtotal,
      discount: discountAmount,
      total,
      paymentMethod: PAYMENT_METHODS.find(p => p.id === paymentMethod)?.label || paymentMethod,
      amountPaid: paid,
      change: calculateChange(),
      customer: customer || undefined,
      operator: username || "sistema",
      status: "concluida",
    }

    addPOSSale(sale)

    // Add transaction
    addTransaction({
      id: `T${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      description: `Venda PDV ${sale.id}${customer ? ` - ${customer}` : ""}`,
      value: total,
      type: "receita",
      category: "Venda Balcao",
      paymentMethod: sale.paymentMethod,
      responsible: username || "sistema",
    })

    addAuditEntry({
      user: username || "sistema",
      action: `Venda finalizada: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      reference: `PDV ${sale.id} - ${sale.paymentMethod}`,
    })

    setLastSale(sale)
    setPaymentOpen(false)
    setReceiptOpen(true)
    clearCart()
  }

  function openCancelSale(sale: POSSale) {
    setSaleToCancel(sale)
    setCancelReason("")
    setSupervisorPassword("")
    setCancelOpen(true)
  }

  function confirmCancelSale() {
    if (!saleToCancel) return
    if (role !== "supervisor" && supervisorPassword !== "1234") return

    updatePOSSale(saleToCancel.id, {
      status: "cancelada",
      cancelReason,
    })

    // Add reversal transaction
    addTransaction({
      id: `T${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      description: `Cancelamento Venda ${saleToCancel.id}`,
      value: saleToCancel.total,
      type: "estorno",
      category: "Cancelamento PDV",
      responsible: username || "sistema",
      notes: cancelReason,
    })

    addAuditEntry({
      user: username || "sistema",
      action: `Venda cancelada: ${saleToCancel.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      reference: `PDV ${saleToCancel.id} - ${cancelReason}`,
    })

    setCancelOpen(false)
    setSaleToCancel(null)
  }

  // Product management functions
  const filteredProductsForManage = useMemo(() => {
    if (!productSearch) return posProducts
    return posProducts.filter(p =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.barcode && p.barcode.includes(productSearch))
    )
  }, [posProducts, productSearch])

  function openAddProduct() {
    setEditingProduct(null)
    setProductForm({ name: "", category: "", price: "", barcode: "" })
    setProductModalOpen(true)
  }

  function openEditProduct(product: POSProduct) {
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      barcode: product.barcode || "",
    })
    setProductModalOpen(true)
  }

  function handleSaveProduct() {
    if (!productForm.name || !productForm.category || !productForm.price) return
    
    if (editingProduct) {
      updatePOSProduct(editingProduct.id, {
        name: productForm.name,
        category: productForm.category,
        price: Number(productForm.price),
        barcode: productForm.barcode || undefined,
      })
      addAuditEntry({
        user: username || "sistema",
        action: `Produto editado: ${productForm.name}`,
        reference: `PDV - ${editingProduct.id}`,
      })
    } else {
      const newId = `P${String(posProducts.length + 1).padStart(3, "0")}-${Date.now()}`
      addPOSProduct({
        id: newId,
        name: productForm.name,
        category: productForm.category,
        price: Number(productForm.price),
        barcode: productForm.barcode || undefined,
      })
      addAuditEntry({
        user: username || "sistema",
        action: `Produto adicionado: ${productForm.name}`,
        reference: `PDV - ${newId}`,
      })
    }
    setProductModalOpen(false)
    setProductForm({ name: "", category: "", price: "", barcode: "" })
    setEditingProduct(null)
  }

  function openDeleteConfirm(product: POSProduct) {
    setProductToDelete(product)
    setDeleteConfirmOpen(true)
  }

  function handleDeleteProduct() {
    if (!productToDelete) return
    removePOSProduct(productToDelete.id)
    addAuditEntry({
      user: username || "sistema",
      action: `Produto removido: ${productToDelete.name}`,
      reference: `PDV - ${productToDelete.id}`,
    })
    setDeleteConfirmOpen(false)
    setProductToDelete(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header with stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Frente de Caixa</h2>
          <p className="text-sm text-muted-foreground">
            Operador: {username} | {todaySales.length} vendas hoje |{" "}
            <span className="font-medium text-success">
              {todayTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setManageProductsOpen(true)}
          >
            <Settings className="size-3.5" />
            Gerenciar Produtos
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="size-3.5" />
            Historico
          </Button>
        </div>
      </div>

      {/* Main POS Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr,400px]">
        {/* Left: Product Selection */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30 pb-4">
            <div className="flex flex-col gap-4">
              {/* Search and Barcode */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                  <div className="relative">
                    <Barcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={barcodeRef}
                      placeholder="Codigo de barras (F2)"
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                      className="w-48 pl-9"
                    />
                  </div>
                </form>
              </div>

              {/* Category Tabs */}
              <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
                <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
                  {categories.map(cat => (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      className="rounded-full border border-transparent bg-secondary/50 px-3 py-1.5 text-xs data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {cat}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary hover:bg-accent hover:shadow-sm active:scale-[0.98]"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight text-foreground line-clamp-2">
                      {product.name}
                    </span>
                    <Package className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {product.category}
                  </Badge>
                  <span className="mt-auto text-base font-bold tabular-nums text-primary">
                    {product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Cart */}
        <Card className="flex flex-col">
          <CardHeader className="border-b border-border bg-muted/30 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="size-4 text-primary" />
                Carrinho
                {cart.length > 0 && (
                  <Badge className="bg-primary text-primary-foreground">
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </Badge>
                )}
              </CardTitle>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={clearCart}
                >
                  <Trash2 className="mr-1 size-3" />
                  Limpar
                </Button>
              )}
            </div>

            {/* Customer selection */}
            <div className="mt-3">
              <Select value={customer || "none"} onValueChange={(v) => setCustomer(v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm">
                  <User className="mr-2 size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Vincular a hospede (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {occupiedRooms.map(room => (
                    <SelectItem key={room.id} value={`Quarto ${room.number} - ${room.guest}`}>
                      Quarto {room.number} - {room.guest}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <ShoppingCart className="size-10 opacity-30" />
                <span className="text-sm">Carrinho vazio</span>
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 animate-fade-in"
                >
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">
                      {item.product.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {item.product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} x {item.quantity}
                      </span>
                      {item.discount > 0 && (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px] text-success">
                          -{item.discount}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => updateQuantity(item.id, -1)}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium tabular-nums">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => updateQuantity(item.id, 1)}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {((item.product.price * item.quantity) * (1 - item.discount / 100)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-primary"
                        onClick={() => openItemDiscount(item)}
                      >
                        <Percent className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>

          {/* Cart Footer */}
          <div className="mt-auto border-t border-border bg-muted/30 p-4">
            {/* Global discount */}
            <div className="mb-3 flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Desconto Geral:</Label>
              <div className="relative w-20">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={globalDiscount || ""}
                  onChange={e => setGlobalDiscount(Number(e.target.value) || 0)}
                  className="h-8 pr-6 text-sm"
                  placeholder="0"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
              {globalDiscount > 0 && (
                <span className="text-xs text-success">
                  -{discountAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              )}
            </div>

            <Separator className="mb-3" />

            {/* Totals */}
            <div className="mb-4 flex flex-col gap-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
              {globalDiscount > 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Desconto ({globalDiscount}%)</span>
                  <span className="tabular-nums">-{discountAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-foreground">
                <span>Total</span>
                <span className="tabular-nums">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
            </div>

            {/* Payment button */}
            <Button
              className="w-full gap-2"
              size="lg"
              disabled={cart.length === 0}
              onClick={openPayment}
            >
              <CreditCard className="size-4" />
              Pagamento
            </Button>
          </div>
        </Card>
      </div>

      {/* Payment Modal */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              Pagamento
            </DialogTitle>
            <DialogDescription>
              Total: <span className="font-bold text-foreground">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {/* Payment method selection */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Forma de Pagamento</Label>
              <ToggleGroup
                type="single"
                value={paymentMethod}
                onValueChange={v => v && setPaymentMethod(v)}
                className="grid grid-cols-2 gap-2"
              >
                {PAYMENT_METHODS.map(method => (
                  <ToggleGroupItem
                    key={method.id}
                    value={method.id}
                    className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border border-border data-[state=on]:border-primary data-[state=on]:bg-primary/10"
                  >
                    <method.icon className="size-5" />
                    <span className="text-xs">{method.label}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Amount paid (for cash) */}
            {paymentMethod === "dinheiro" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="amountPaid" className="text-sm font-medium">
                  Valor Recebido
                </Label>
                <Input
                  id="amountPaid"
                  type="number"
                  step="0.01"
                  min={total}
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder={total.toFixed(2)}
                  className="text-lg"
                  autoFocus
                />
                {Number(amountPaid) >= total && (
                  <div className="flex items-center justify-between rounded-lg bg-success/10 px-3 py-2">
                    <span className="text-sm text-success">Troco:</span>
                    <span className="text-lg font-bold tabular-nums text-success">
                      {calculateChange().toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Quick cash buttons */}
            {paymentMethod === "dinheiro" && (
              <div className="flex flex-wrap gap-2">
                {[10, 20, 50, 100, 200].map(value => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmountPaid(String(value))}
                    disabled={value < total}
                  >
                    {value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmountPaid(total.toFixed(2))}
                >
                  Exato
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={finalizeSale}
              disabled={paymentMethod === "dinheiro" && (Number(amountPaid) || 0) < total}
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              Finalizar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-success">
              <CheckCircle2 className="size-5" />
              Venda Finalizada!
            </DialogTitle>
          </DialogHeader>

          {lastSale && (
            <div className="flex flex-col gap-4 py-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs">
                <div className="mb-2 text-center">
                  <p className="font-bold">POUSADA SOL & MAR</p>
                  <p className="text-muted-foreground">CUPOM NAO FISCAL</p>
                </div>
                <Separator className="my-2" />
                <div className="mb-2 flex justify-between text-muted-foreground">
                  <span>Venda:</span>
                  <span>{lastSale.id}</span>
                </div>
                <div className="mb-2 flex justify-between text-muted-foreground">
                  <span>Data:</span>
                  <span>{new Date(lastSale.date).toLocaleString("pt-BR")}</span>
                </div>
                {lastSale.customer && (
                  <div className="mb-2 flex justify-between text-muted-foreground">
                    <span>Cliente:</span>
                    <span className="text-right">{lastSale.customer}</span>
                  </div>
                )}
                <Separator className="my-2" />
                {lastSale.items.map(item => (
                  <div key={item.id} className="mb-1">
                    <div className="flex justify-between">
                      <span className="truncate pr-2">{item.product.name}</span>
                      <span className="tabular-nums">
                        {((item.product.price * item.quantity) * (1 - item.discount / 100)).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {item.quantity}x {item.product.price.toFixed(2)}
                      {item.discount > 0 && ` (-${item.discount}%)`}
                    </div>
                  </div>
                ))}
                <Separator className="my-2" />
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Desconto:</span>
                    <span className="tabular-nums">-{lastSale.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <span>TOTAL:</span>
                  <span className="tabular-nums">{lastSale.total.toFixed(2)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between">
                  <span>{lastSale.paymentMethod}:</span>
                  <span className="tabular-nums">{lastSale.amountPaid.toFixed(2)}</span>
                </div>
                {lastSale.change > 0 && (
                  <div className="flex justify-between">
                    <span>Troco:</span>
                    <span className="tabular-nums">{lastSale.change.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <p className="text-center text-muted-foreground">
                  Operador: {lastSale.operator}
                </p>
                <p className="mt-2 text-center text-muted-foreground">
                  Obrigado pela preferencia!
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button className="w-full gap-2" onClick={() => setReceiptOpen(false)}>
              <Receipt className="size-4" />
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Discount Modal */}
      <Dialog open={itemDiscountOpen} onOpenChange={setItemDiscountOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="size-4 text-primary" />
              Desconto no Item
            </DialogTitle>
            <DialogDescription>
              {itemToDiscount?.product.name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="itemDiscount">Percentual de Desconto</Label>
            <div className="relative mt-2">
              <Input
                id="itemDiscount"
                type="number"
                min="0"
                max="100"
                value={itemDiscountValue}
                onChange={e => setItemDiscountValue(e.target.value)}
                className="pr-8"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDiscountOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={applyItemDiscount}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales History Sheet */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="flex flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              Historico de Vendas
            </SheetTitle>
            <SheetDescription>
              Vendas realizadas hoje
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex flex-col gap-3">
            {posSales.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma venda registrada
              </p>
            ) : (
              posSales
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(sale => (
                  <div
                    key={sale.id}
                    className={`rounded-lg border p-3 ${
                      sale.status === "cancelada"
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{sale.id}</span>
                          <Badge
                            variant={sale.status === "concluida" ? "default" : "destructive"}
                            className="text-[10px]"
                          >
                            {sale.status === "concluida" ? "Concluida" : "Cancelada"}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(sale.date).toLocaleString("pt-BR")}
                        </span>
                        {sale.customer && (
                          <span className="text-xs text-muted-foreground">{sale.customer}</span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-bold tabular-nums ${sale.status === "cancelada" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {sale.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                        <span className="text-xs text-muted-foreground">{sale.paymentMethod}</span>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground">
                      {sale.items.map(i => `${i.quantity}x ${i.product.name}`).join(", ")}
                    </div>

                    {sale.status === "concluida" && role === "supervisor" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => openCancelSale(sale)}
                      >
                        <XCircle className="mr-1 size-3" />
                        Cancelar Venda
                      </Button>
                    )}
                    {sale.status === "concluida" && role !== "supervisor" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => openCancelSale(sale)}
                      >
                        <XCircle className="mr-1 size-3" />
                        Cancelar Venda (Supervisor)
                      </Button>
                    )}
                    {sale.cancelReason && (
                      <p className="mt-2 text-xs italic text-destructive">
                        Motivo: {sale.cancelReason}
                      </p>
                    )}
                  </div>
                ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel Sale Modal */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="size-5" />
              Cancelar Venda
            </DialogTitle>
            <DialogDescription>
              Venda {saleToCancel?.id} - {saleToCancel?.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cancelReason">Motivo do Cancelamento *</Label>
              <Input
                id="cancelReason"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Descreva o motivo..."
              />
            </div>

            {role !== "supervisor" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="supervisorPwd">Senha do Supervisor *</Label>
                <Input
                  id="supervisorPwd"
                  type="password"
                  value={supervisorPassword}
                  onChange={e => setSupervisorPassword(e.target.value)}
                  placeholder="Digite a senha..."
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancelSale}
              disabled={!cancelReason || (role !== "supervisor" && supervisorPassword !== "1234")}
            >
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Products Sheet */}
      <Sheet open={manageProductsOpen} onOpenChange={setManageProductsOpen}>
        <SheetContent className="flex flex-col overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="size-5 text-primary" />
              Gerenciar Produtos
            </SheetTitle>
            <SheetDescription>
              Adicione, edite ou remova produtos do catalogo
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button className="gap-1.5" onClick={openAddProduct}>
                <Plus className="size-4" />
                Novo Produto
              </Button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto">
              {filteredProductsForManage.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum produto encontrado</p>
              ) : (
                filteredProductsForManage.map(product => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-accent/50"
                  >
                    <Package className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">{product.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>
                        {product.barcode && (
                          <span className="text-[10px] text-muted-foreground">{product.barcode}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-primary">
                      {product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-primary"
                        onClick={() => openEditProduct(product)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => openDeleteConfirm(product)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-xs text-muted-foreground">Total de Produtos</span>
              <Badge className="bg-primary text-primary-foreground">{posProducts.length}</Badge>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add/Edit Product Modal */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingProduct ? <Pencil className="size-5 text-primary" /> : <Plus className="size-5 text-primary" />}
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct ? `Editando: ${editingProduct.name}` : "Preencha os dados do novo produto"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="productName">Nome do Produto *</Label>
              <Input
                id="productName"
                value={productForm.name}
                onChange={e => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Agua Mineral 500ml"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="productCategory">Categoria *</Label>
              <Select
                value={productForm.category || "none"}
                onValueChange={v => setProductForm(prev => ({ ...prev, category: v === "none" ? "" : v }))}
              >
                <SelectTrigger id="productCategory">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  <SelectItem value="Bebidas">Bebidas</SelectItem>
                  <SelectItem value="Lanches">Lanches</SelectItem>
                  <SelectItem value="Doces">Doces</SelectItem>
                  <SelectItem value="Servicos">Servicos</SelectItem>
                  <SelectItem value="Frigobar">Frigobar</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="productPrice">Preco (R$) *</Label>
                <Input
                  id="productPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.price}
                  onChange={e => setProductForm(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0,00"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="productBarcode">Codigo de Barras</Label>
                <Input
                  id="productBarcode"
                  value={productForm.barcode}
                  onChange={e => setProductForm(prev => ({ ...prev, barcode: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveProduct}
              disabled={!productForm.name || !productForm.category || !productForm.price}
            >
              {editingProduct ? "Salvar Alteracoes" : "Adicionar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Product Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              Remover Produto
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o produto?
            </DialogDescription>
          </DialogHeader>

          {productToDelete && (
            <div className="flex items-center gap-3 rounded-lg bg-destructive/5 p-3">
              <Package className="size-5 text-destructive" />
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium text-foreground">{productToDelete.name}</span>
                <span className="text-xs text-muted-foreground">{productToDelete.category}</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {productToDelete.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct}>
              Remover Produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
