"use client"
import { getDataConfig } from "@/lib/data/config"
import { PermissionGate } from "@/components/permission-gate"

import { useToast } from "@/hooks/use-toast"

import { BankAccountPicker } from "./payment-fields"
import { CashTurnShortcut } from "./cash-turn-shortcut"
import { pousadaProducts } from "@/lib/pousada-scope"
import { useState, useEffect, useRef } from "react"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription, SheetFooter,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useNotifications } from "@/lib/notification-context"
import { useProductSearch } from "@/lib/hooks/useProductSearch"
import { useConsumption } from "@/lib/hooks/useConsumption"
import { Plus, Trash2, ShoppingCart,  Search } from "lucide-react"
import type { Room } from "@/lib/store"

type Props = {
  room: Room
  open: boolean
  onClose: () => void
}

export function ConsumptionSheet({ room, open, onClose }: Props) {
  const {
    addConsumptionItem, removeConsumptionItem, getConsumption, addAuditEntry,
    runOperation, posProducts,
    getCategoryName, productCategories, stays = [], cashCloses = [],
  } = useApp()
  const { username, can } = useAuth()
  const { toast } = useToast()
  const [paying, setPaying] = useState(false)
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const [quantity, setQuantity] = useState(1)
  const expectedStayId = useRef<string | undefined>(undefined)
  const [boundStayId, setBoundStayId] = useState<string>()
  const initialized = useRef(false)
  const currentStay = stays.find(stay => stay.roomId === room.id && stay.status === "active")
  const changedContext = getDataConfig().adapter === 'database' && open && (!boundStayId || currentStay?.id !== boundStayId)
  useEffect(() => {
    if (!open) { initialized.current = false; return }
    if (!initialized.current) { expectedStayId.current = currentStay?.id; setBoundStayId(currentStay?.id); initialized.current = true }
  }, [open, currentStay?.id])
  const [paymentAccountId, setPaymentAccountId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("pix")
  const cashClosed = !cashCloses.some(turn => turn.status === "aberto")
  const needsCash = cashClosed && paymentMethod === "dinheiro"
  const { sendNotification } = useNotifications()

  const [customLabel, setCustomLabel] = useState("")
  const [customPrice, setCustomPrice] = useState("")
  const [customQty, setCustomQty] = useState("1")

  const consumption = getConsumption(room.id)
  const items = consumption?.items || []

  // Use custom hooks
  const {
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    categories,
    filteredProducts
  } = useProductSearch(pousadaProducts(posProducts, productCategories).filter(p => p.active !== false), getCategoryName)

  const {
    total,
    addCatalogItem,
    addCustomItem,
    removeConsumptionItem: removeItem
  } = useConsumption({
    roomId: room.id,
    stayId: boundStayId,
    items,
    addItem: (roomId, item) => addConsumptionItem(roomId, item, expectedStayId.current),
    removeItem: removeConsumptionItem,
  })

  async function handleAddCatalogItem(name: string, unitPrice: number, productId: string) {
    if (sendingRef.current || paying || cashClosed) return
    sendingRef.current = true; setSending(true)
    try { await addCatalogItem(name, unitPrice, productId, quantity) } catch (error) { toast({ title: "Consumo não lançado", description: String(error), variant: "destructive" }); return }
    finally { sendingRef.current = false; setSending(false) }
    addAuditEntry({ entityType: "consumptions", operation: "create",
      user: username || "sistema",
      action: `Consumo lancado: ${name}`,
      reference: `Quarto ${room.number} - ${room.guest}`,
    })
    sendNotification(
      'pos',
      'Consumo Lançado',
      `${name} adicionado ao Quarto ${room.number}`,
      'low',
      String(room.id)
    )
  }

  async function handleAddCustomItem() {
    if (!customLabel || !customPrice || sendingRef.current || paying || cashClosed) return
    sendingRef.current = true; setSending(true)
    try { await addCustomItem(customLabel, Number(customPrice), Number(customQty) || 1) } catch (error) { toast({ title: "Consumo não lançado", description: String(error), variant: "destructive" }); return }
    finally { sendingRef.current = false; setSending(false) }
    addAuditEntry({ entityType: "consumptions", operation: "create",
      user: username || "sistema",
      action: `Consumo lancado: ${customLabel}`,
      reference: `Quarto ${room.number} - ${room.guest}`,
    })
    sendNotification(
      'pos',
      'Consumo Lançado',
      `${customLabel} adicionado ao Quarto ${room.number}`,
      'low',
      String(room.id)
    )
    setCustomLabel("")
    setCustomPrice("")
    setCustomQty("1")
  }

  async function handleRemoveItem(itemId: string) {
    try { await removeItem(itemId) } catch (error) { toast({ title: "Item não removido", description: String(error), variant: "destructive" }) }
  }
  async function payConsumption() {
    if (paying || sendingRef.current || needsCash) return
    setPaying(true)
    try {
      await runOperation("pay-consumption", { roomId: room.id, expectedStayId: expectedStayId.current, recordVersion: currentStay?.recordVersion, paymentMethod, accountId: paymentMethod.toLowerCase() === "dinheiro" ? undefined : paymentAccountId || undefined })
      toast({ title: "Consumo quitado" })
    } catch (error) { toast({ title: "Pagamento não concluído", description: String(error), variant: "destructive" }) }
    finally { setPaying(false) }
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v && !sendingRef.current && !paying) onClose() }}>
      <SheetContent onEscapeKeyDown={event => { if (sending || paying) event.preventDefault() }} onInteractOutside={event => { if (sending || paying) event.preventDefault() }} className="consumption-sheet flex flex-col overflow-hidden p-4 sm:max-w-lg sm:p-5">
        <SheetHeader className="shrink-0 p-0 pr-6">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-primary" />
            Consumo - Quarto {room.number}
          </SheetTitle>
          <SheetDescription>
            {room.guest} - Lançamento de itens consumidos
          </SheetDescription>
        </SheetHeader>

        {cashClosed && <div role="status" className="grid gap-2 rounded-lg border bg-secondary/40 p-3 text-sm">
          <p>Caixa fechado — abra para vender ou lançar bebidas na hospedagem. Você pode consultar e quitar o consumo existente por PIX ou cartão.</p>
          <div><CashTurnShortcut /></div>
        </div>}
        <div className="consumption-sheet-body flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain py-4 pr-1">
          {/* Search and Category Filter */}
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
              <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
                {categories.map(cat => (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="rounded-full border border-transparent bg-secondary/50 px-2.5 py-1 text-[10px] data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Product catalog */}
          <div className="flex flex-col gap-2">
            {changedContext && <p role="alert" className="text-sm text-destructive">A hospedagem mudou ou ainda não está identificada. Feche e reabra o consumo do hóspede correto.</p>}
            <Label>Quantidade por entrega<Input aria-label="Quantidade por entrega" type="number" min={1} max={1000} value={quantity} disabled={sending || paying} onChange={event => setQuantity(Number(event.target.value))} /></Label>
            {sending && <p role="status" className="text-sm">Registrando entrega…</p>}
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Catálogo de bebidas ({filteredProducts.length})
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {filteredProducts.map((product) => (
                <button
                  disabled={cashClosed || !can("consumptions.create") || changedContext || sending || paying || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000}
                  aria-label={`Adicionar ${product.name} à ficha de consumo`}
                  key={product.id}
                  onClick={() => handleAddCatalogItem(product.name, product.price, product.id)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent hover:border-primary"
                >
                  <Plus className="size-3.5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-foreground break-words">{product.name}</span>
                    <CurrencyDisplay value={product.price} size="sm" className="text-[10px]" />
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="col-span-2 py-4 text-center text-xs text-muted-foreground">
                  Nenhum produto encontrado
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Custom item */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Item Personalizado
            </Label>
            <div className="flex gap-2">
              <Input
                aria-label="Descrição do item" placeholder="Descrição"
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                aria-label="Preço do item" placeholder="R$"
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
                className="w-20"
              />
              <Input
                type="number"
                aria-label="Quantidade do item" placeholder="Qtd"
                value={customQty}
                onChange={e => setCustomQty(e.target.value)}
                className="w-16"
              />
              <PermissionGate permission="consumptions.custom"><Button
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={cashClosed || !customLabel || !customPrice || changedContext || sending || paying}
                aria-label="Adicionar item personalizado" onClick={handleAddCustomItem}
              >
                <Plus className="size-4" />
              </Button></PermissionGate>
            </div>
          </div>

          <Separator />

          {/* Items list */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Itens lançados ({items.length})
            </Label>
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum item lançado</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2 animate-fade-in"
                  >
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="text-sm font-medium text-foreground break-words">{item.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.quantity}x <CurrencyDisplay value={item.unitPrice} size="sm" className="inline" />
                      </span>
                    </div>
                    <CurrencyDisplay value={item.unitPrice * item.quantity} size="sm" className="font-semibold" />
                    <PermissionGate permission="consumptions.remove" approval><Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                      aria-label={`Remover ${item.label}`} onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button></PermissionGate>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="shrink-0 border-t border-border px-0 pb-0 pt-4 flex-col gap-3">
          {total > 0 && <div className="grid w-full min-w-0 items-start gap-3 sm:grid-cols-2">
            <Label className="flex min-w-0 flex-col items-stretch gap-1">Forma de pagamento<select aria-label="Forma de pagamento" className="mt-1 min-h-11 min-w-0 rounded-md border bg-background p-2" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="debito">Débito</option><option value="credito">Crédito</option>
            </select></Label>
            <BankAccountPicker method={paymentMethod} accountId={paymentAccountId} setAccountId={setPaymentAccountId} /><PermissionGate permission="consumptions.receive"><Button className="w-full sm:col-span-2" disabled={changedContext || paying || sending || needsCash} onClick={payConsumption}>{paying ? "Registrando..." : "Quitar consumo"}</Button></PermissionGate>
          </div>}
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Total do consumo</span>
              <CurrencyDisplay value={total} size="lg" className="text-xl" />
            </div>
            <Badge className="bg-primary/10 text-primary border-transparent">
              {items.length} {items.length === 1 ? "item" : "itens"}
            </Badge>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
