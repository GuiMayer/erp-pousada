"use client"

import { useState, useEffect } from "react"
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
    name: "",
    category: "",
    price: "",
    barcode: "",
    trackStock: false
  })
  const [error, setError] = useState("")

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        category: product.category,
        price: product.price.toString(),
        barcode: product.barcode || "",
        trackStock: product.trackStock
      })
    } else {
      setFormData({
        name: "",
        category: "",
        price: "",
        barcode: "",
        trackStock: false
      })
    }
    setError("")
  }, [product, open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    // Validations
    if (!formData.name.trim()) {
      setError("Nome do produto é obrigatório")
      return
    }

    if (!formData.category) {
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
      name: formData.name.trim(),
      category: formData.category,
      price: price,
      barcode: formData.barcode.trim() || undefined,
      trackStock: formData.trackStock
    }

    if (product) {
      // Update existing product
      updatePOSProduct(product.id, productData)
    } else {
      // Create new product
      const newProduct: POSProduct = {
        id: `P${Date.now()}`,
        ...productData as Required<Omit<POSProduct, 'barcode'>>
      }
      addPOSProduct(newProduct)
    }

    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar Produto" : "Novo Produto"}
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
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione uma categoria..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bebidas">Bebidas</SelectItem>
                <SelectItem value="Lanches">Lanches</SelectItem>
                <SelectItem value="Doces">Doces</SelectItem>
                <SelectItem value="Servicos">Serviços</SelectItem>
                <SelectItem value="Frigobar">Frigobar</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Preço (R$) *</Label>
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
