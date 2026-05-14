"use client"

import { useState, useMemo } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import type { ProductCategory } from "@/lib/store"
import { Plus, Pencil, Trash2, Tag, AlertTriangle } from "lucide-react"

type Props = {
  open: boolean
  onClose: () => void
}

export function ManageRestaurantCategoriesModal({ open, onClose }: Props) {
  const { posProducts, productCategories, updateProductCategory, addProductCategory, addAuditEntry } = useApp()
  const { username } = useAuth()

  const [mode, setMode] = useState<"list" | "add" | "edit">("list")
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ProductCategory | null>(null)

  // Form fields
  const [categoryName, setCategoryName] = useState("")
  const [categoryColor, setCategoryColor] = useState("#6b7280")
  const [categoryIcon, setCategoryIcon] = useState("UtensilsCrossed")
  const [formError, setFormError] = useState("")

  // Calculate product count by category dynamically
  const productCountByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    posProducts.forEach(product => {
      const current = counts.get(product.category) || 0
      counts.set(product.category, current + 1)
    })
    return counts
  }, [posProducts])

  // Filter only restaurant categories
  const restaurantCategories = useMemo(() => 
    productCategories.filter(c => c.isRestaurant),
    [productCategories]
  )

  function resetForm() {
    setCategoryName("")
    setCategoryColor("#6b7280")
    setCategoryIcon("UtensilsCrossed")
    setFormError("")
    setEditingCategory(null)
  }

  async function handleAdd() {
    if (!categoryName.trim()) {
      setFormError("Digite o nome da categoria.")
      return
    }
    const exists = restaurantCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
    if (exists) {
      setFormError("Já existe uma categoria com esse nome.")
      return
    }
    
    const newCategory: ProductCategory = {
      id: `pcat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: categoryName.trim(),
      color: categoryColor,
      icon: categoryIcon,
      active: true,
      isRestaurant: true,
    }
    
    await addProductCategory(newCategory)
    addAuditEntry({ 
      user: username || "sistema", 
      action: "Categoria de restaurante adicionada", 
      reference: categoryName 
    })
    resetForm()
    setMode("list")
  }

  async function handleEdit() {
    if (!editingCategory || !categoryName.trim()) {
      setFormError("Digite o nome da categoria.")
      return
    }
    const duplicate = restaurantCategories.find(
      c => c.name.toLowerCase() === categoryName.toLowerCase() && c.id !== editingCategory.id
    )
    if (duplicate) {
      setFormError("Já existe uma categoria com esse nome.")
      return
    }
    
    await updateProductCategory(editingCategory.id, { 
      name: categoryName.trim(),
      color: categoryColor,
      icon: categoryIcon
    })
    addAuditEntry({ 
      user: username || "sistema", 
      action: "Categoria de restaurante editada", 
      reference: categoryName 
    })
    resetForm()
    setMode("list")
  }

  async function handleDelete(category: ProductCategory) {
    const usageCount = productCountByCategory.get(category.id) || 0
    
    if (usageCount > 0) {
      setFormError("Não é possível excluir uma categoria em uso.")
      return
    }
    
    await updateProductCategory(category.id, { active: false })
    addAuditEntry({ 
      user: username || "sistema", 
      action: "Categoria de restaurante desativada", 
      reference: category.name 
    })
    setDeleteConfirm(null)
  }

  function startEdit(category: ProductCategory) {
    setEditingCategory(category)
    setCategoryName(category.name)
    setCategoryColor(category.color)
    setCategoryIcon(category.icon)
    setMode("edit")
  }

  function handleClose() {
    resetForm()
    setMode("list")
    onClose()
  }

  const availableIcons = [
    "UtensilsCrossed", "Salad", "IceCream", "GlassWater", 
    "Soup", "Coffee", "Cake", "Pizza", "Sandwich"
  ]

  const availableColors = [
    "#ef4444", "#f97316", "#f59e0b", "#84cc16", 
    "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"
  ]

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Gerenciar Categorias do Restaurante
            </DialogTitle>
            <DialogDescription>
              Organize os produtos do cardápio em categorias
            </DialogDescription>
          </DialogHeader>

          {mode === "list" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {restaurantCategories.length} categoria(s) cadastrada(s)
                </p>
                <Button size="sm" onClick={() => setMode("add")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Categoria
                </Button>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {restaurantCategories.map(category => {
                  const count = productCountByCategory.get(category.id) || 0
                  return (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center"
                          style={{ backgroundColor: `${category.color}20` }}
                        >
                          <Tag className="h-4 w-4" style={{ color: category.color }} />
                        </div>
                        <div>
                          <div className="font-medium">{category.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {count} produto(s)
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirm(category)}
                          disabled={count > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(mode === "add" || mode === "edit") && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="categoryName">Nome da Categoria *</Label>
                <Input
                  id="categoryName"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Ex: Pratos Principais"
                />
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {availableColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      className="w-8 h-8 rounded-md border-2 transition-all hover:scale-110"
                      style={{ 
                        backgroundColor: color,
                        borderColor: categoryColor === color ? "#000" : "transparent"
                      }}
                      onClick={() => setCategoryColor(color)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ícone</Label>
                <div className="flex gap-2 flex-wrap">
                  {availableIcons.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      className="w-10 h-10 rounded-md border-2 flex items-center justify-center transition-all hover:scale-110"
                      style={{ 
                        borderColor: categoryIcon === icon ? categoryColor : "#e5e7eb"
                      }}
                      onClick={() => setCategoryIcon(icon)}
                    >
                      <Tag className="h-5 w-5" style={{ color: categoryColor }} />
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                  {formError}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { resetForm(); setMode("list") }}>
                  Cancelar
                </Button>
                <Button onClick={mode === "add" ? handleAdd : handleEdit}>
                  {mode === "add" ? "Criar Categoria" : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria <strong>{deleteConfirm?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
