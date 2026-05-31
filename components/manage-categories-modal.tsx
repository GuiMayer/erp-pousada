"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import type { ProductCategory } from "@/lib/store"
import { 
  Plus, Pencil, Trash2, Tag, AlertTriangle, Package, Coffee, 
  UtensilsCrossed, Wine, Cake, Pizza, IceCream, Sandwich, 
  Apple, Beef, Fish, Salad, Soup, Cookie, Croissant, Drumstick,
  Milk, Beer, GlassWater, Martini, CupSoda, Candy, Popcorn,
  ShoppingBag, ShoppingCart, Store, Sparkles, Star, Heart,
  Flame, Zap, Crown, Gift, Palette, Check
} from "lucide-react"

type CategoryType = "pdv" | "restaurant"

type Props = {
  open: boolean
  onClose: () => void
  defaultTab?: CategoryType
}

// Available icons for categories
const AVAILABLE_ICONS = [
  { name: "Package", icon: Package },
  { name: "Coffee", icon: Coffee },
  { name: "UtensilsCrossed", icon: UtensilsCrossed },
  { name: "Wine", icon: Wine },
  { name: "Cake", icon: Cake },
  { name: "Pizza", icon: Pizza },
  { name: "IceCream", icon: IceCream },
  { name: "Sandwich", icon: Sandwich },
  { name: "Apple", icon: Apple },
  { name: "Beef", icon: Beef },
  { name: "Fish", icon: Fish },
  { name: "Salad", icon: Salad },
  { name: "Soup", icon: Soup },
  { name: "Cookie", icon: Cookie },
  { name: "Croissant", icon: Croissant },
  { name: "Drumstick", icon: Drumstick },
  { name: "Milk", icon: Milk },
  { name: "Beer", icon: Beer },
  { name: "GlassWater", icon: GlassWater },
  { name: "Martini", icon: Martini },
  { name: "CupSoda", icon: CupSoda },
  { name: "Candy", icon: Candy },
  { name: "Popcorn", icon: Popcorn },
  { name: "ShoppingBag", icon: ShoppingBag },
  { name: "ShoppingCart", icon: ShoppingCart },
  { name: "Store", icon: Store },
  { name: "Sparkles", icon: Sparkles },
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "Flame", icon: Flame },
  { name: "Zap", icon: Zap },
  { name: "Crown", icon: Crown },
  { name: "Gift", icon: Gift },
  { name: "Palette", icon: Palette },
]

// Preset colors for quick selection
const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
  "#6b7280", // gray
]

export function ManageCategoriesModal({ open, onClose, defaultTab = "pdv" }: Props) {
  const { posProducts, productCategories, updateProductCategory, addProductCategory, removeProductCategory, addAuditEntry } = useApp()
  const { username } = useAuth()

  const [activeTab, setActiveTab] = useState<CategoryType>(defaultTab)
  const [mode, setMode] = useState<"list" | "add" | "edit">("list")
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ProductCategory | null>(null)
  const [hardDelete, setHardDelete] = useState(false)

  // Form fields
  const [categoryName, setCategoryName] = useState("")
  const [categoryColor, setCategoryColor] = useState("#6b7280")
  const [categoryIcon, setCategoryIcon] = useState("Package")
  const [formError, setFormError] = useState("")
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  // Calculate product count by category dynamically
  const productCountByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    posProducts.forEach(product => {
      const current = counts.get(product.categoryId) || 0
      counts.set(product.categoryId, current + 1)
    })
    return counts
  }, [posProducts])

  const deleteConfirmUsageCount = deleteConfirm ? productCountByCategory.get(deleteConfirm.id) || 0 : 0

  // Filter categories by type
  const pdvCategories = useMemo(() => 
    productCategories.filter(c => !c.isRestaurant),
    [productCategories]
  )

  const restaurantCategories = useMemo(() => 
    productCategories.filter(c => c.isRestaurant),
    [productCategories]
  )

  // Sync active tab with defaultTab when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab)
      setMode("list")
      resetForm()
    }
  }, [open, defaultTab])

  function resetForm() {
    setCategoryName("")
    setCategoryColor("#6b7280")
    setCategoryIcon("Package")
    setFormError("")
    setEditingCategory(null)
  }

  function getCurrentCategories(): ProductCategory[] {
    return activeTab === "pdv" ? pdvCategories : restaurantCategories
  }

  async function handleAdd() {
    if (!categoryName.trim()) {
      setFormError("Digite o nome da categoria.")
      return
    }
    const categories = getCurrentCategories()
    const exists = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
    if (exists) {
      setFormError("Ja existe uma categoria com esse nome.")
      return
    }
    
    const newCategory: ProductCategory = {
      id: `pcat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: categoryName.trim(),
      color: categoryColor,
      icon: categoryIcon,
      active: true,
      isRestaurant: activeTab === "restaurant",
    }
    
    await addProductCategory(newCategory)
    addAuditEntry({ 
      user: username || "sistema", 
      action: "Categoria adicionada", 
      reference: `${categoryName} (${activeTab === "pdv" ? "PDV" : "Restaurante"})` 
    })
    resetForm()
    setMode("list")
  }

  async function handleEdit() {
    if (!editingCategory || !categoryName.trim()) {
      setFormError("Digite o nome da categoria.")
      return
    }
    const categories = getCurrentCategories()
    const duplicate = categories.find(
      c => c.name.toLowerCase() === categoryName.toLowerCase() && c.id !== editingCategory.id
    )
    if (duplicate) {
      setFormError("Ja existe uma categoria com esse nome.")
      return
    }
    
    await updateProductCategory(editingCategory.id, { 
      name: categoryName.trim(),
      color: categoryColor,
      icon: categoryIcon
    })
    addAuditEntry({ 
      user: username || "sistema", 
      action: "Categoria editada", 
      reference: categoryName 
    })
    resetForm()
    setMode("list")
  }

  async function handleDelete(category: ProductCategory, hard: boolean) {
    const usageCount = productCountByCategory.get(category.id) || 0
    
    if (hard) {
      if (usageCount > 0) {
        setFormError("Nao e possivel excluir uma categoria em uso.")
        return
      }
      await removeProductCategory(category.id)
      addAuditEntry({ 
        user: username || "sistema", 
        action: "Categoria removida", 
        reference: category.name 
      })
    } else {
      await updateProductCategory(category.id, { active: false })
      addAuditEntry({ 
        user: username || "sistema", 
        action: "Categoria desativada", 
        reference: category.name 
      })
    }
    setDeleteConfirm(null)
    setHardDelete(false)
    setFormError("")
  }

  function openEdit(category: ProductCategory) {
    setEditingCategory(category)
    setCategoryName(category.name)
    setCategoryColor(category.color)
    setCategoryIcon(category.icon)
    setFormError("")
    setMode("edit")
  }

  function openDelete(category: ProductCategory) {
    setDeleteConfirm(category)
    setFormError("")
  }

  const sortedCategories = useMemo(() => {
    return [...getCurrentCategories()].map(cat => ({
      ...cat,
      usageCount: productCountByCategory.get(cat.id) || 0
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [pdvCategories, restaurantCategories, activeTab, productCountByCategory])

  const activeCategories = sortedCategories.filter(c => c.active)
  const inactiveCategories = sortedCategories.filter(c => !c.active)

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setMode("list"); resetForm() } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-5 text-primary" />
              Gerenciar Categorias
            </DialogTitle>
            <DialogDescription>
              Organize as categorias de produtos do PDV e Restaurante.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v: string) => { setActiveTab(v as CategoryType); setMode("list"); resetForm() }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pdv">PDV</TabsTrigger>
              <TabsTrigger value="restaurant">Restaurante</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="flex flex-1 flex-col gap-4 overflow-hidden mt-4">
              {mode === "list" && (
                <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                  <Button
                    size="sm" className="gap-1.5 w-fit"
                    onClick={() => { resetForm(); setMode("add") }}
                  >
                    <Plus className="size-4" /> Nova Categoria
                  </Button>

                  {activeCategories.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Ativas</h3>
                      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-60 pr-1">
                        {activeCategories.map((category) => (
                          <div
                            key={category.id}
                            className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2.5"
                          >
                            <div className="flex flex-1 items-center gap-3 min-w-0">
                              <div 
                                className="size-4 rounded-full shrink-0 border border-border" 
                                style={{ backgroundColor: category.color }}
                              />
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground">{category.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {category.usageCount || 0} {category.usageCount === 1 ? "produto" : "produtos"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm" variant="ghost"
                                className="size-8 p-0"
                                onClick={() => openEdit(category)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                className="size-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => openDelete(category)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {inactiveCategories.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Inativas</h3>
                      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-40 pr-1">
                        {inactiveCategories.map((category) => (
                          <div
                            key={category.id}
                            className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5 opacity-60"
                          >
                            <div className="flex flex-1 items-center gap-3 min-w-0">
                              <div 
                                className="size-4 rounded-full shrink-0 border border-border" 
                                style={{ backgroundColor: category.color }}
                              />
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground">{category.name}</span>
                                  <Badge variant="secondary" className="text-xs">Inativa</Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm" variant="ghost"
                                className="size-8 p-0"
                                onClick={async () => {
                                  await updateProductCategory(category.id, { active: true })
                                  addAuditEntry({ 
                                    user: username || "sistema", 
                                    action: "Categoria reativada", 
                                    reference: category.name 
                                  })
                                }}
                              >
                                Reativar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(mode === "add" || mode === "edit") && (
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="categoryName">Nome da Categoria</Label>
                    <Input
                      id="categoryName"
                      value={categoryName}
                      onChange={e => setCategoryName(e.target.value)}
                      placeholder="Ex: Bebidas, Lanches..."
                      autoFocus
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex flex-col gap-2 flex-1">
                      <Label>Cor</Label>
                      <div className="grid grid-cols-9 gap-1.5">
                        {PRESET_COLORS.map(color => (
                          <button
                            key={color}
                            type="button"
                            className="w-7 h-7 rounded border-2 border-border hover:border-foreground transition-colors relative"
                            style={{ backgroundColor: color }}
                            onClick={() => setCategoryColor(color)}
                          >
                            {categoryColor === color && (
                              <Check className="absolute inset-0 m-auto size-4 text-white drop-shadow-md" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 flex-1">
                      <Label>Ícone</Label>
                      <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start gap-2 h-10"
                          >
                            {(() => {
                              const IconComponent = AVAILABLE_ICONS.find(i => i.name === categoryIcon)?.icon || Package
                              return <IconComponent className="size-4" style={{ color: categoryColor }} />
                            })()}
                            <span className="text-sm">{categoryIcon}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-3" align="start">
                          <div className="grid grid-cols-6 gap-2">
                            {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                              <button
                                key={name}
                                type="button"
                                className={`
                                  flex items-center justify-center w-full h-10 rounded border-2 
                                  hover:border-foreground transition-colors
                                  ${categoryIcon === name ? 'border-foreground bg-accent' : 'border-border'}
                                `}
                                onClick={() => {
                                  setCategoryIcon(name)
                                  setIconPickerOpen(false)
                                }}
                                title={name}
                              >
                                <Icon className="size-5" style={{ color: categoryColor }} />
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  {formError && (
                    <p className="text-sm text-destructive">{formError}</p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            {mode === "list" && (
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            )}
            {mode === "add" && (
              <>
                <Button variant="outline" onClick={() => { setMode("list"); resetForm() }}>
                  Cancelar
                </Button>
                <Button onClick={handleAdd}>Adicionar</Button>
              </>
            )}
            {mode === "edit" && (
              <>
                <Button variant="outline" onClick={() => { setMode("list"); resetForm() }}>
                  Cancelar
                </Button>
                <Button onClick={handleEdit}>Salvar</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={v => { if (!v) { setDeleteConfirm(null); setHardDelete(false); setFormError("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja {hardDelete ? "excluir permanentemente" : "desativar"} a categoria "{deleteConfirm?.name}"?
              {deleteConfirmUsageCount > 0 && (
                <span className="flex items-center gap-2 mt-2 text-orange-600">
                  <AlertTriangle className="size-4" />
                  Esta categoria esta sendo usada por {deleteConfirmUsageCount} {deleteConfirmUsageCount === 1 ? "produto" : "produtos"}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="hardDelete"
              checked={hardDelete}
              onCheckedChange={(checked) => setHardDelete(checked === true)}
              disabled={deleteConfirmUsageCount > 0}
            />
            <Label 
              htmlFor="hardDelete" 
              className={`text-sm cursor-pointer ${deleteConfirmUsageCount > 0 ? "opacity-50" : ""}`}
            >
              Excluir permanentemente (nao pode ser desfeito)
            </Label>
          </div>
          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setHardDelete(false); setFormError("") }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm, hardDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {hardDelete ? "Excluir" : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
