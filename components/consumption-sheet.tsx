"use client"

import { useState } from "react"
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
import { Plus, Trash2, ShoppingCart, Package, Search } from "lucide-react"
import type { Room } from "@/lib/store"

type Props = {
  room: Room
  open: boolean
  onClose: () => void
}

export function ConsumptionSheet({ room, open, onClose }: Props) {
  const { 
    addConsumptionItem, removeConsumptionItem, getConsumption, addAuditEntry,
    posProducts,
    getCategoryName,
  } = useApp()
  const { username } = useAuth()
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
  } = useProductSearch(posProducts, getCategoryName)

  const { 
    total,
    addCatalogItem,
    addCustomItem,
    removeConsumptionItem: removeItem
  } = useConsumption({
    roomId: room.id,
    items,
    addItem: addConsumptionItem,
    removeItem: removeConsumptionItem,
  })

  function handleAddCatalogItem(name: string, unitPrice: number) {
    addCatalogItem(name, unitPrice)
    addAuditEntry({
      user: username || "sistema",
      action: `Consumo lancado: ${name}`,
      reference: `Quarto ${room.number} - ${room.guest}`,
    })
    sendNotification(
      'pos',
      'Consumo Lançado',
      `${name} adicionado ao Quarto ${room.number}`,
      'low',
      room.id
    )
  }

  function handleAddCustomItem() {
    if (!customLabel || !customPrice) return
    addCustomItem(customLabel, Number(customPrice), Number(customQty) || 1)
    addAuditEntry({
      user: username || "sistema",
      action: `Consumo lancado: ${customLabel}`,
      reference: `Quarto ${room.number} - ${room.guest}`,
    })
    sendNotification(
      'pos',
      'Consumo Lançado',
      `${customLabel} adicionado ao Quarto ${room.number}`,
      'low',
      room.id
    )
    setCustomLabel("")
    setCustomPrice("")
    setCustomQty("1")
  }

  function handleRemoveItem(itemId: string) {
    removeItem(itemId)
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent className="flex flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-primary" />
            Consumo - Quarto {room.number}
          </SheetTitle>
          <SheetDescription>
            {room.guest} - Lancamento de itens consumidos
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 py-4">
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
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Catalogo de Produtos ({filteredProducts.length})
            </Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleAddCatalogItem(product.name, product.price)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent hover:border-primary"
                >
                  <Package className="size-3.5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">{product.name}</span>
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
                placeholder="Descricao"
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="R$"
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
                className="w-20"
              />
              <Input
                type="number"
                placeholder="Qtd"
                value={customQty}
                onChange={e => setCustomQty(e.target.value)}
                className="w-16"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={!customLabel || !customPrice}
                onClick={handleAddCustomItem}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Items list */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Itens Lancados ({items.length})
            </Label>
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum item lancado</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2 animate-fade-in"
                  >
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">{item.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.quantity}x <CurrencyDisplay value={item.unitPrice} size="sm" className="inline" />
                      </span>
                    </div>
                    <CurrencyDisplay value={item.unitPrice * item.quantity} size="sm" className="font-semibold" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="border-t border-border pt-4">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Total Consumo</span>
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
