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
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Plus, Trash2, ShoppingCart, Package } from "lucide-react"
import type { Room } from "@/lib/store"

const CATALOG = [
  { label: "Agua Mineral", unitPrice: 5 },
  { label: "Refrigerante", unitPrice: 8 },
  { label: "Cerveja", unitPrice: 12 },
  { label: "Suco Natural", unitPrice: 10 },
  { label: "Snack / Salgadinho", unitPrice: 7 },
  { label: "Chocolate", unitPrice: 6 },
  { label: "Toalha Extra", unitPrice: 15 },
  { label: "Frigobar Completo", unitPrice: 45 },
]

type Props = {
  room: Room
  open: boolean
  onClose: () => void
}

export function ConsumptionSheet({ room, open, onClose }: Props) {
  const { addConsumptionItem, removeConsumptionItem, getConsumption, addAuditEntry } = useApp()
  const { username } = useAuth()

  const [customLabel, setCustomLabel] = useState("")
  const [customPrice, setCustomPrice] = useState("")
  const [customQty, setCustomQty] = useState("1")

  const consumption = getConsumption(room.id)
  const items = consumption?.items || []
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  function handleAddCatalogItem(label: string, unitPrice: number) {
    addConsumptionItem(room.id, {
      id: `CI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      unitPrice,
      quantity: 1,
    })
    addAuditEntry({
      user: username || "sistema",
      action: `Consumo lancado: ${label}`,
      reference: `Quarto ${room.number} - ${room.guest}`,
    })
  }

  function handleAddCustomItem() {
    if (!customLabel || !customPrice) return
    addConsumptionItem(room.id, {
      id: `CI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: customLabel,
      unitPrice: Number(customPrice),
      quantity: Number(customQty) || 1,
    })
    addAuditEntry({
      user: username || "sistema",
      action: `Consumo lancado: ${customLabel}`,
      reference: `Quarto ${room.number} - ${room.guest}`,
    })
    setCustomLabel("")
    setCustomPrice("")
    setCustomQty("1")
  }

  function handleRemoveItem(itemId: string) {
    removeConsumptionItem(room.id, itemId)
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent className="flex flex-col overflow-y-auto sm:max-w-md">
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
          {/* Quick catalog */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Catalogo Rapido
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {CATALOG.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleAddCatalogItem(item.label, item.unitPrice)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <Package className="size-3.5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">{item.label}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {item.unitPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                </button>
              ))}
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
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {item.quantity}x {item.unitPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {(item.unitPrice * item.quantity).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
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
              <span className="text-xl font-bold tabular-nums text-foreground">
                {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
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
