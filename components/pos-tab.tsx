"use client"
import { formatNumber as localizedNumber } from "@/lib/utils/formatters"
import { validateSupervisorPasswordAsync } from "@/lib/utils/validators"
import { useTaskState, useTaskRef } from "@/contexts/task-drafts-context"
import { CashWorkspace } from "./cash-workspace"
import { PermissionGate } from "@/components/permission-gate"


import { getDataConfig } from "@/lib/data/config"

import { POSCheckoutDialog,type CheckoutSelection } from "./pos-checkout-dialog"
import { useState, useMemo, useRef, useEffect } from "react"
import { pousadaProducts } from "@/lib/pousada-scope"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { calculateCartSubtotal, calculateCartTotal, calculateItemTotal, formatCurrency, formatCurrencyFixed } from "@/lib/utils/price-calculations"
import { getTodayISO } from "@/lib/utils/constants"
import { formatDateTime } from "@/lib/utils/date-formatting"
import { stockAvailable, validateStockAvailability as validateStockItemAvailability } from "@/lib/utils/stock-validation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
  Receipt, X, Percent, User, Barcode,
  CheckCircle2, XCircle, History, Package,
} from "lucide-react"
import { type POSProduct, type POSCartItem, type POSSale } from "@/lib/store"


export function POSTab() {
  const {
    posProducts: allProducts, posSales, stays = [], rooms, stockItems,
    runOperation, getCategoryName, productCategories,
  } = useApp()
  const posProducts = useMemo(() => pousadaProducts(allProducts, productCategories).filter(p => p.active !== false), [allProducts, productCategories])
  const { username, role, can } = useAuth()
  const { toast } = useToast()

  const [cartAnnouncement, setCartAnnouncement] = useState("")
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const cartRef = useRef<HTMLDivElement>(null)
  // Cart state
  const [cart, setCart] = useTaskState<POSCartItem[]>("pos.cart", [])
  const [searchQuery, setSearchQuery] = useState("")
  const [barcodeInput, setBarcodeInput] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [globalDiscount, setGlobalDiscount] = useTaskState("pos.globalDiscount", 0)
  const [customer, setCustomer] = useTaskState("pos.customerStayId", "")

  // Payment modal
  const [paymentOpen, setPaymentOpen] = useTaskState("pos.paymentOpen", false)
  const [returnToStock, setReturnToStock] = useState(false)

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

  const barcodeRef = useRef<HTMLInputElement>(null)

  // Categories
  const categories = useMemo(() => {
    const uniqueCategoryIds = new Set(posProducts.map(p => p.categoryId))
    const categoryObjects = Array.from(uniqueCategoryIds)
      .map(id => productCategories.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined && c.active && !c.isRestaurant)
    return [
      { id: "all", name: "Todos" },
      ...categoryObjects
    ]
  }, [posProducts, productCategories])

  // Filtered products
  const filteredProducts = useMemo(() => {
    return posProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery))
      const matchesCategory = categoryFilter === "all" || p.categoryId === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [posProducts, searchQuery, categoryFilter])

  // Cart calculations
  const subtotal = useMemo(() => calculateCartSubtotal(cart), [cart])

  const discountAmount = subtotal * (globalDiscount / 100)
  const total = calculateCartTotal(subtotal, discountAmount)

  // Today's sales
  const todaySales = useMemo(() => {
    const today = getTodayISO()
    return posSales.filter(s => s.date.startsWith(today) && s.status === "concluida")
  }, [posSales])

  const todayTotal = useMemo(() => {
    return todaySales.reduce((sum, s) => sum + s.total, 0)
  }, [todaySales])

  const activeStays = can("stays.read") ? stays.filter(stay => stay.status === "active") : []

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
    // Check stock availability before adding
    const stockItem = stockItems.find(s => s.productId === product.id)
    const currentInCart = cart.find(item => item.product.id === product.id)?.quantity || 0
    const newQuantity = currentInCart + 1

    // Use centralized stock validation
    const validation = product.trackStock ? validateStockItemAvailability(stockItem, newQuantity, product.name, getDataConfig().adapter === "database") : { isValid: true }

    if (!validation.isValid && validation.error) {
      toast(validation.error)
      return
    }

    if (validation.warning) {
      toast(validation.warning)
    }

    setCartAnnouncement(`${product.name} adicionado ao carrinho. Quantidade: ${newQuantity}.`)
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
    setCart(prev => {
      const item = prev.find(i => i.id === itemId)
      if (!item) return prev

      const newQty = Math.max(0, item.quantity + delta)

      // If increasing quantity, check stock availability
      if (delta > 0) {
        const stockItem = stockItems.find(s => s.productId === item.product.id)
        const validation = item.product.trackStock ? validateStockItemAvailability(stockItem, newQty, item.product.name, getDataConfig().adapter === "database") : { isValid: true }

        if (!validation.isValid && validation.error) {
          toast(validation.error)
          return prev
        }
      }

      return prev.map(i => {
        if (i.id === itemId) {
          return { ...i, quantity: newQty }
        }
        return i
      }).filter(i => i.quantity > 0)
    })
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
    operationRef.current = crypto.randomUUID()
    if (cart.length === 0) return
    setPaymentOpen(true)
  }

  async function finalizeIntegratedSale(selection:CheckoutSelection) {
    operationRef.current??=crypto.randomUUID()
    const saved=await runOperation<POSSale>('sale',{sale:{id:operationRef.current,items:cart,total,amountPaid:selection.stayId?0:selection.payments!.reduce((v,p)=>v+p.value,0),customer:activeStays.find(s=>s.id===customer)?.guestName,...selection},globalDiscount},operationRef.current)
    setLastSale(saved);setPaymentOpen(false);setReceiptOpen(true);setCart([]);setGlobalDiscount(0);setCustomer('');operationRef.current=null
    toast({title:selection.stayId?'Entrega lançada na hospedagem':'Venda recebida',description:saved.id})
  }
  const operationRef = useTaskRef<string | null>("pos.operation", null)

  function openCancelSale(sale: POSSale) {
    setReturnToStock(false)
    setSaleToCancel(sale)
    setCancelReason("")
    setSupervisorPassword("")
    setCancelOpen(true)
  }

  async function confirmCancelSale() {
    if (!saleToCancel) return
    if (getDataConfig().adapter === "demo-localStorage" && role !== "supervisor" && !await validateSupervisorPasswordAsync(supervisorPassword)) { toast({ title: "Aprovação recusada", variant: "destructive" }); return }
    try {
      await runOperation("cancel-sale", { saleId: saleToCancel.id, reason: cancelReason, returnToStock })
      setCancelOpen(false); setSaleToCancel(null); setCancelReason(""); setSupervisorPassword("")
      toast({ title: "Venda estornada" })
    } catch (error) { toast({ title: "Estorno não concluído", description: error instanceof Error ? error.message : "Tente novamente", variant: "destructive" }) }
  }

  if (!can("pos.sell")) return <div className="space-y-4"><h2 className="text-xl font-semibold">Frente de Caixa</h2><CashWorkspace /></div>

  return (
    <div className="pos-workspace flex flex-col gap-3">
      {/* Header with stats */}
      <div className="pos-toolbar flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="hidden text-lg font-semibold text-foreground sm:block">Frente de Caixa</h2>
          <p className="text-sm text-muted-foreground">
            {todaySales.length} vendas hoje ·{" "}
            <span className="font-medium text-success">
              {formatCurrency(todayTotal)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="size-3.5" />
            Histórico de vendas
          </Button>
        </div>
      </div>

      <CashWorkspace />
      <p role="status" aria-live="polite" className="sr-only">{cartAnnouncement}</p>
      <Button className={`mobile-cart-bar sm:hidden ${mobileCartOpen ? "mobile-cart-bar-review" : ""}`} onClick={() => { setMobileCartOpen(true); requestAnimationFrame(() => cartRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })) }}><ShoppingCart className="size-5" />{cart.reduce((sum, item) => sum + item.quantity, 0)} itens · {formatCurrency(total)} · Ver carrinho</Button>
      {/* Main POS Layout */}
      <div className="pos-layout grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        {/* Left: Product Selection */}
        <Card className="pos-catalog overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30 pb-4">
            <div className="flex flex-col gap-4">
              {/* Search and Barcode */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                  <div className="relative w-full sm:w-auto">
                    <Barcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={barcodeRef}
                      placeholder="Codigo de barras (F2)"
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                      className="w-full pl-9 sm:w-48"
                    />
                  </div>
                </form>
              </div>

              {/* Category Tabs */}
              <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
                <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
                  {categories.map(cat => (
                    <TabsTrigger
                      key={cat.id}
                      value={cat.id}
                      className="rounded-full border border-transparent bg-secondary/50 px-3 py-1.5 text-xs data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {cat.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <CardContent className="pos-catalog-body mobile-catalog max-h-[45dvh] overflow-y-auto p-3 lg:max-h-none">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {filteredProducts.map(product => (
                <button
                  aria-label={`Adicionar ${product.name} ao carrinho`}
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary hover:bg-accent hover:shadow-sm active:scale-[0.98]"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight text-foreground line-clamp-2">
                      {product.name}
                    </span>
                    <Plus aria-hidden className="size-4 shrink-0 text-primary" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {getCategoryName(product.categoryId)}
                  </Badge>
                  <span className="mt-auto text-base font-bold tabular-nums text-primary">
                    {formatCurrency(product.price)}
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
        <Card ref={cartRef} className={`pos-cart mobile-cart flex flex-col ${mobileCartOpen ? "mobile-cart-open" : ""}`}>
          <Button variant="outline" className="sm:hidden mx-4" onClick={() => setMobileCartOpen(false)}>Voltar aos produtos</Button>
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
            <div className="mt-3 space-y-2">
              <Label id="pos-guest-label">Hóspede (opcional)</Label>
              <Select value={customer || "none"} onValueChange={(v) => setCustomer(v === "none" ? "" : v)}>
                <SelectTrigger aria-labelledby="pos-guest-label" className="h-9 text-sm">
                  <User className="mr-2 size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Hóspede (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Venda avulsa</SelectItem>
                  {activeStays.map(stay => (
                    <SelectItem key={stay.id} value={stay.id}>
                      Quarto {rooms.find(room => room.id === stay.roomId)?.number ?? stay.roomId} - {stay.guestName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="pos-cart-items flex flex-1 flex-col gap-3 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <ShoppingCart className="size-10 opacity-30" />
                <span className="text-sm">Carrinho vazio</span>
              </div>
            ) : (
              cart.map(item => {
                const stockItem = stockItems.find(s => s.productId === item.product.id)
                const availableStock = stockAvailable(stockItem, getDataConfig().adapter === "database")
                const stockStatus = availableStock === undefined ? 'unknown' :
                  availableStock <= 0 ? 'critical' :
                  item.quantity >= availableStock ? 'warning' :
                  availableStock <= ((stockItem?.minimumStock ?? 0) * 1.5) ? 'low' : 'ok'

                return (
                  <div
                    key={item.id}
                    className="mobile-cart-item flex items-center gap-3 rounded-lg border border-border bg-card p-3 animate-fade-in"
                  >
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {item.product.name}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(item.product.price)} x {item.quantity}
                        </span>
                        {item.discount > 0 && (
                          <Badge variant="secondary" className="h-4 px-1 text-[10px] text-success">
                            -{item.discount}%
                          </Badge>
                        )}
                        {stockItem && (
                          <div className="flex items-center gap-1">
                            <Package className="size-3 text-muted-foreground" />
                            <span className={`text-[10px] font-medium ${
                              stockStatus === 'critical' ? 'text-destructive' :
                              stockStatus === 'warning' ? 'text-warning' :
                              stockStatus === 'low' ? 'text-warning' :
                              'text-muted-foreground'
                            }`}>
                              {availableStock === undefined ? "Saldo não confirmado" : `${availableStock} ${stockItem.unit} utilizáveis`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        aria-label={`Diminuir quantidade de ${item.product.name}`}
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
                        aria-label={`Aumentar quantidade de ${item.product.name}`}
                      onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(calculateItemTotal(item.product.price, item.quantity, item.discount))}
                      </span>
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-primary"
                          aria-label={`Desconto de ${item.product.name}`}
                          onClick={() => openItemDiscount(item)}
                        >
                          <Percent className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive"
                          aria-label={`Remover ${item.product.name}`}
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>

          {/* Cart Footer */}
          <div className="pos-cart-footer mt-auto border-t border-border bg-muted/30 p-3">
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
                  -{formatCurrency(discountAmount)}
                </span>
              )}
            </div>

            <Separator className="mb-3" />

            {/* Totals */}
            <div className="mb-4 flex flex-col gap-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              {globalDiscount > 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Desconto ({globalDiscount}%)</span>
                  <span className="tabular-nums">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-foreground">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
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
      {paymentOpen && <POSCheckoutDialog total={total} initialStayId={customer} onClose={() => setPaymentOpen(false)} onConfirm={finalizeIntegratedSale} />}

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
                  <span>{formatDateTime(lastSale.date)}</span>
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
                        {formatCurrencyFixed(calculateItemTotal(item.product.price, item.quantity, item.discount))}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {item.quantity}x {localizedNumber(item.product.price, 2)}
                      {item.discount > 0 && ` (-${item.discount}%)`}
                    </div>
                  </div>
                ))}
                <Separator className="my-2" />
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Desconto:</span>
                    <span className="tabular-nums">-{localizedNumber(lastSale.discount, 2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <span>TOTAL:</span>
                  <span className="tabular-nums">{localizedNumber(lastSale.total, 2)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between">
                  <span>{lastSale.paymentMethod}:</span>
                  <span className="tabular-nums">{localizedNumber(lastSale.amountPaid, 2)}</span>
                </div>
                {lastSale.payments?.map((payment, index) => <div key={index} className="flex justify-between text-xs"><span>{payment.method}</span><span>{formatCurrency(payment.applied ?? payment.value)}</span></div>)}
                {lastSale.stayId && <p className="text-xs">Lançado na conta da hospedagem; sem recebimento no balcão.</p>}
                {lastSale.change > 0 && (
                  <div className="flex justify-between">
                    <span>Troco:</span>
                    <span className="tabular-nums">{localizedNumber(lastSale.change, 2)}</span>
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
                          {formatDateTime(sale.date)}
                        </span>
                        {sale.customer && (
                          <span className="text-xs text-muted-foreground">{sale.customer}</span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-bold tabular-nums ${sale.status === "cancelada" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {formatCurrency(sale.total)}
                        </span>
                        <span className="text-xs text-muted-foreground">{sale.paymentMethod}</span>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground">
                      {sale.items.map(i => `${i.quantity}x ${i.product.name}`).join(", ")}
                    </div>

                    {sale.status === "concluida" && can("pos.refund") && (
                      <PermissionGate permission="pos.refund" approval><Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => openCancelSale(sale)}
                      >
                        <XCircle className="mr-1 size-3" />
                        Cancelar Venda
                      </Button></PermissionGate>
                    )}
                    {sale.status === "concluida" && !can("pos.refund") && (
                      <PermissionGate permission="pos.refund" approval><Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => openCancelSale(sale)}
                      >
                        <XCircle className="mr-1 size-3" />
                        Cancelar Venda (Supervisor)
                      </Button></PermissionGate>
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
              Venda {saleToCancel?.id} - {formatCurrency(saleToCancel?.total || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={returnToStock} onChange={event => setReturnToStock(event.target.checked)} />Devolução física: repor produtos no estoque</label>
              <Label htmlFor="cancelReason">Motivo do Cancelamento *</Label>
              <Input
                id="cancelReason"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Descreva o motivo..."
              />
            </div>

            {getDataConfig().adapter === "demo-localStorage" && role !== "supervisor" && (
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
              disabled={!cancelReason || (getDataConfig().adapter === "demo-localStorage" && role !== "supervisor" && !supervisorPassword)}
            >
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  )
}
