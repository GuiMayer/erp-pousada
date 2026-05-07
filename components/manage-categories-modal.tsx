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
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Plus, Pencil, Trash2, Tag, AlertTriangle } from "lucide-react"

type CategoryType = "pdv" | "restaurant"

interface Category {
  id: string
  name: string
  type: CategoryType
  active: boolean
  usageCount?: number
}

type Props = {
  open: boolean
  onClose: () => void
}

export function ManageCategoriesModal({ open, onClose }: Props) {
  const { products, addAuditEntry } = useApp()
  const { username } = useAuth()

  const [activeTab, setActiveTab] = useState<CategoryType>("pdv")
  const [mode, setMode] = useState<"list" | "add" | "edit">("list")
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null)
  const [hardDelete, setHardDelete] = useState(false)

  // Form fields
  const [categoryName, setCategoryName] = useState("")
  const [formError, setFormError] = useState("")

  // Mock categories - in a real app, these would come from the store
  const [pdvCategories, setPdvCategories] = useState<Category[]>([
    { id: "cat-1", name: "Bebidas", type: "pdv", active: true, usageCount: 15 },
    { id: "cat-2", name: "Lanches", type: "pdv", active: true, usageCount: 8 },
    { id: "cat-3", name: "Doces", type: "pdv", active: true, usageCount: 12 },
    { id: "cat-4", name: "Servicos", type: "pdv", active: true, usageCount: 5 },
    { id: "cat-5", name: "Frigobar", type: "pdv", active: true, usageCount: 20 },
    { id: "cat-6", name: "Outros", type: "pdv", active: true, usageCount: 3 },
  ])

  const [restaurantCategories, setRestaurantCategories] = useState<Category[]>([
    { id: "cat-r1", name: "Entradas", type: "restaurant", active: true, usageCount: 6 },
    { id: "cat-r2", name: "Pratos Principais", type: "restaurant", active: true, usageCount: 10 },
    { id: "cat-r3", name: "Sobremesas", type: "restaurant", active: true, usageCount: 8 },
    { id: "cat-r4", name: "Bebidas", type: "restaurant", active: true, usageCount: 12 },
    { id: "cat-r5", name: "Acompanhamentos", type: "restaurant", active: true, usageCount: 7 },
  ])

  function resetForm() {
    setCategoryName("")
    setFormError("")
    setEditingCategory(null)
  }

  function getCurrentCategories(): Category[] {
    return activeTab === "pdv" ? pdvCategories : restaurantCategories
  }

  function setCurrentCategories(categories: Category[]) {
    if (activeTab === "pdv") {
      setPdvCategories(categories)
    } else {
      setRestaurantCategories(categories)
    }
  }

  function handleAdd() {
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
    const newId = `cat-${activeTab}-${Date.now()}`
    const newCategory: Category = {
      id: newId,
      name: categoryName.trim(),
      type: activeTab,
      active: true,
      usageCount: 0,
    }
    setCurrentCategories([...categories, newCategory])
    addAuditEntry({ 
      user: username || "sistema", 
      action: "Categoria adicionada", 
      reference: `${categoryName} (${activeTab === "pdv" ? "PDV" : "Restaurante"})` 
    })
    resetForm()
    setMode("list")
  }

  function handleEdit() {
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
    const updated = categories.map(c =>
      c.id === editingCategory.id ? { ...c, name: categoryName.trim() } : c
    )
    setCurrentCategories(updated)
    addAuditEntry({ 
      user: username || "sistema", 
      action: "Categoria editada", 
      reference: categoryName 
    })
    resetForm()
    setMode("list")
  }

  function handleDelete(category: Category, hard: boolean) {
    const categories = getCurrentCategories()
    if (hard) {
      if (category.usageCount && category.usageCount > 0) {
        setFormError("Nao e possivel excluir uma categoria em uso.")
        return
      }
      const filtered = categories.filter(c => c.id !== category.id)
      setCurrentCategories(filtered)
      addAuditEntry({ 
        user: username || "sistema", 
        action: "Categoria removida", 
        reference: category.name 
      })
    } else {
      const updated = categories.map(c =>
        c.id === category.id ? { ...c, active: false } : c
      )
      setCurrentCategories(updated)
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

  function openEdit(category: Category) {
    setEditingCategory(category)
    setCategoryName(category.name)
    setFormError("")
    setMode("edit")
  }

  function openDelete(category: Category) {
    setDeleteConfirm(category)
    setFormError("")
  }

  const sortedCategories = useMemo(() => {
    return [...getCurrentCategories()].sort((a, b) => a.name.localeCompare(b.name))
  }, [pdvCategories, restaurantCategories, activeTab])

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

          <Tabs value={activeTab} onValueChange={(v: string) => { setActiveTab(v); setMode("list"); resetForm() }}>
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
                                onClick={() => {
                                  const categories = getCurrentCategories()
                                  const updated = categories.map(c =>
                                    c.id === category.id ? { ...c, active: true } : c
                                  )
                                  setCurrentCategories(updated)
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
              {deleteConfirm?.usageCount && deleteConfirm.usageCount > 0 && (
                <span className="flex items-center gap-2 mt-2 text-orange-600">
                  <AlertTriangle className="size-4" />
                  Esta categoria esta sendo usada por {deleteConfirm.usageCount} {deleteConfirm.usageCount === 1 ? "produto" : "produtos"}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="hardDelete"
              checked={hardDelete}
              onCheckedChange={(checked) => setHardDelete(checked === true)}
              disabled={deleteConfirm?.usageCount ? deleteConfirm.usageCount > 0 : false}
            />
            <Label 
              htmlFor="hardDelete" 
              className={`text-sm cursor-pointer ${deleteConfirm?.usageCount && deleteConfirm.usageCount > 0 ? "opacity-50" : ""}`}
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
