"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useApp } from "@/lib/app-context"
import type { POSProduct } from "@/lib/store"

interface ProductFormModalProps {
  open: boolean
  onClose: () => void
  product?: POSProduct
}

export function ProductFormModal({ open, onClose, product }: ProductFormModalProps) {
  const { posProducts, addPOSProduct, updatePOSProduct, productCategories } = useApp()

  const [formData, setFormData] = useState({
    active: true, unit: "un" as NonNullable<POSProduct["unit"]>, name: "",
    categoryId: "",
    price: "",
    barcode: "",
    requiresExpiry: true, trackStock: false
  })
  const wasOpen = useRef(false)
  const original = useRef(product)
  const [error, setError] = useState("")

  // Filter categories based on type
  const filteredCategories = productCategories.filter(c =>
    c.active && !c.isRestaurant
  )

  useEffect(() => {
    if (!open) { wasOpen.current = false; return }
    if (wasOpen.current) return
    wasOpen.current = true; original.current = product
    if (product) {
      setFormData({
        active: product.active !== false, unit: product.unit ?? "un", name: product.name,
        categoryId: product.categoryId,
        price: product.price.toString(),
        barcode: product.barcode || "",
        requiresExpiry: product.requiresExpiry ?? false, trackStock: product.trackStock
      })
    } else {
      setFormData({
        active: true, unit: "un", name: "",
        categoryId: "",
        price: "",
        barcode: "",
        requiresExpiry: true, trackStock: false
      })
    }
    setError("")
  }, [product, open])

  async function handleSubmit(e: React.FormEvent) {
    try {
    e.preventDefault()
    setError("")

    // Validations
    if (!formData.name.trim()) {
      setError("Nome do produto é obrigatório")
      return
    }

    if (!formData.categoryId) {
      setError("Categoria é obrigatória")
      return
    }

    const price = parseFloat(formData.price)
    if (isNaN(price) || price <= 0) {
      setError("Preço deve ser maior que zero")
      return
    }

    // Check barcode uniqueness (if provided)
    if (formData.barcode.trim()) {
      const existingProduct = posProducts.find(
        p => p.barcode === formData.barcode.trim() && p.id !== product?.id
      )
      if (existingProduct) {
        setError(`Código de barras já usado no produto: ${existingProduct.name}`)
        return
      }
    }

    const productData: Partial<POSProduct> = {
      active: formData.active, unit: formData.unit, name: formData.name.trim(),
      categoryId: formData.categoryId,
      price: price,
      barcode: formData.barcode.trim() || undefined,
      requiresExpiry: formData.requiresExpiry, trackStock: formData.trackStock
    }

    if (product) {
      // Update existing product
      await updatePOSProduct(product.id, { ...productData, recordVersion: original.current?.recordVersion })
    } else {
      // Create new product
      const newProduct: POSProduct = {
        id: crypto.randomUUID(),
        ...productData as Required<Omit<POSProduct, 'id' | 'barcode'>>
      }
      await addPOSProduct(newProduct)
    }

    onClose()

    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar") }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent mobileTask protectDraft className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar bebida" : "Nova bebida"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Produto *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Água Mineral 500ml"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Select
              value={formData.categoryId}
              onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione uma categoria..." />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.length === 0 ? (
                  <SelectItem value="no-category" disabled>
                    Nenhuma categoria disponível
                  </SelectItem>
                ) : (
                  filteredCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Preço padrão de venda (R$) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Código de Barras</Label>
            <Input
              id="barcode"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="Ex: 7891234567890"
            />
          </div>

          <div className="space-y-2"><Label htmlFor="product-unit">Unidade base de venda e estoque</Label><select id="product-unit" className="h-11 w-full rounded-md border bg-background px-2" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value as NonNullable<POSProduct['unit']> })}><option value="un">Unidade (garrafa, lata, copo)</option><option value="ml">Mililitro</option><option value="l">Litro</option></select><p className="text-xs text-muted-foreground">A venda baixa a quantidade nesta unidade. Bebida com estoque conserva sua unidade base.</p></div>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} />Disponível para venda</label>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="trackStock"
              checked={formData.trackStock}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, trackStock: checked as boolean })
              }
            />
            <Label htmlFor="trackStock" className="text-sm font-normal cursor-pointer">
              Controlar estoque (requer item no estoque para vender)
            </Label>
          </div>

          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={formData.requiresExpiry} onChange={e=>setFormData({...formData,requiresExpiry:e.target.checked})}/>Exigir lote e validade real no recebimento</label>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {product ? "Salvar Alterações" : "Criar Produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
