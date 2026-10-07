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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Plus, Pencil, Trash2, ChefHat, Copy, Search, AlertTriangle, DollarSign, Clock } from "lucide-react"
import type { Recipe, RecipeIngredient, StockUnit } from "@/lib/store"
import { generateRecipeId } from "@/lib/utils/id-generators"

const RECIPE_CATEGORIES = ["Entradas", "Pratos Principais", "Sobremesas", "Bebidas", "Acompanhamentos", "Molhos", "Outros"]
const STOCK_UNITS: StockUnit[] = ["kg", "un", "lt", "cx"]

type Props = {
  open: boolean
  onClose: () => void
}

export function ManageRecipesModal({ open, onClose }: Props) {
  const { recipes, stockItems, addRecipe, updateRecipe, addAuditEntry } = useApp()
  const { username } = useAuth()

  const [mode, setMode] = useState<"list" | "add" | "edit">("list")
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Recipe | null>(null)
  const [hardDelete, setHardDelete] = useState(false)

  // Form fields
  const [recipeName, setRecipeName] = useState("")
  const [category, setCategory] = useState("")
  const [expectedYield, setExpectedYield] = useState("")
  const [yieldUnit, setYieldUnit] = useState<StockUnit>("un")
  const [preparationTime, setPreparationTime] = useState("")
  const [instructions, setInstructions] = useState("")
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [formError, setFormError] = useState("")

  // Ingredient form
  const [selectedProductId, setSelectedProductId] = useState("")
  const [ingredientQuantity, setIngredientQuantity] = useState("")
  const [ingredientUnit, setIngredientUnit] = useState<StockUnit>("kg")

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("Todos")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active")

  function resetForm() {
    setRecipeName("")
    setCategory("")
    setExpectedYield("")
    setYieldUnit("un")
    setPreparationTime("")
    setInstructions("")
    setIngredients([])
    setFormError("")
    setEditingRecipe(null)
    setSelectedProductId("")
    setIngredientQuantity("")
    setIngredientUnit("kg")
  }

  function addIngredient() {
    if (!selectedProductId || !ingredientQuantity) {
      setFormError("Selecione um produto e informe a quantidade.")
      return
    }
    const qty = parseFloat(ingredientQuantity)
    if (isNaN(qty) || qty <= 0) {
      setFormError("Quantidade deve ser maior que zero.")
      return
    }
    const stockItem = stockItems.find(s => s.productId === selectedProductId)
    if (!stockItem) {
      setFormError("Produto nao encontrado no estoque.")
      return
    }
    const alreadyAdded = ingredients.find(i => i.productId === selectedProductId)
    if (alreadyAdded) {
      setFormError("Este ingrediente ja foi adicionado.")
      return
    }
    const newIngredient: RecipeIngredient = {
      productId: stockItem.productId,
      productName: stockItem.productName,
      quantity: qty,
      unit: ingredientUnit,
      cost: stockItem.averageCost * qty,
    }
    setIngredients([...ingredients, newIngredient])
    setSelectedProductId("")
    setIngredientQuantity("")
    setFormError("")
  }

  function removeIngredient(productId: string) {
    setIngredients(ingredients.filter(i => i.productId !== productId))
  }

  const totalCost = useMemo(() => {
    return ingredients.reduce((sum, ing) => sum + ing.cost, 0)
  }, [ingredients])

  const costPerUnit = useMemo(() => {
    const yield_ = parseFloat(expectedYield)
    if (isNaN(yield_) || yield_ <= 0) return 0
    return totalCost / yield_
  }, [totalCost, expectedYield])

  function checkAvailability(): { available: boolean; missing: string[] } {
    const missing: string[] = []
    for (const ing of ingredients) {
      const stockItem = stockItems.find(s => s.productId === ing.productId)
      if (!stockItem || stockItem.currentStock < ing.quantity) {
        missing.push(ing.productName)
      }
    }
    return { available: missing.length === 0, missing }
  }

  function handleAdd() {
    if (!recipeName || !category || !expectedYield || !preparationTime) {
      setFormError("Preencha todos os campos obrigatorios.")
      return
    }
    if (ingredients.length === 0) {
      setFormError("Adicione pelo menos um ingrediente.")
      return
    }
    const yield_ = parseFloat(expectedYield)
    const prepTime = parseInt(preparationTime)
    if (isNaN(yield_) || yield_ <= 0) {
      setFormError("Rendimento deve ser maior que zero.")
      return
    }
    if (isNaN(prepTime) || prepTime <= 0) {
      setFormError("Tempo de preparo deve ser maior que zero.")
      return
    }
    const exists = recipes.find(r => r.name.toLowerCase() === recipeName.toLowerCase())
    if (exists) {
      setFormError("Ja existe uma receita com esse nome.")
      return
    }
    const newId = generateRecipeId()
    const newRecipe: Recipe = {
      id: newId,
      name: recipeName,
      category,
      version: 1,
      ingredients,
      expectedYield: yield_,
      yieldUnit,
      preparationTime: prepTime,
      instructions,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    addRecipe(newRecipe)
    addAuditEntry({ user: username || "sistema", action: "Receita adicionada", reference: `${recipeName} (v1)` })
    resetForm()
    setMode("list")
  }

  function handleEdit() {
    if (!editingRecipe || !recipeName || !category || !expectedYield || !preparationTime) {
      setFormError("Preencha todos os campos obrigatorios.")
      return
    }
    if (ingredients.length === 0) {
      setFormError("Adicione pelo menos um ingrediente.")
      return
    }
    const yield_ = parseFloat(expectedYield)
    const prepTime = parseInt(preparationTime)
    if (isNaN(yield_) || yield_ <= 0) {
      setFormError("Rendimento deve ser maior que zero.")
      return
    }
    if (isNaN(prepTime) || prepTime <= 0) {
      setFormError("Tempo de preparo deve ser maior que zero.")
      return
    }
    const duplicate = recipes.find(r => r.name.toLowerCase() === recipeName.toLowerCase() && r.id !== editingRecipe.id)
    if (duplicate) {
      setFormError("Ja existe uma receita com esse nome.")
      return
    }
    updateRecipe(editingRecipe.id, {
      name: recipeName,
      category,
      ingredients,
      expectedYield: yield_,
      yieldUnit,
      preparationTime: prepTime,
      instructions,
      version: editingRecipe.version + 1,
      updatedAt: new Date().toISOString(),
    })
    addAuditEntry({ user: username || "sistema", action: "Receita editada", reference: `${recipeName} (v${editingRecipe.version + 1})` })
    resetForm()
    setMode("list")
  }

  function handleDelete(recipe: Recipe, hard: boolean) {
    if (hard) {
      // Hard delete not implemented for recipes - would need to check productions
      setFormError("Exclusao permanente de receitas nao e permitida.")
      return
    } else {
      updateRecipe(recipe.id, { active: false })
      addAuditEntry({ user: username || "sistema", action: "Receita desativada", reference: recipe.name })
    }
    setDeleteConfirm(null)
    setHardDelete(false)
  }

  function openEdit(recipe: Recipe) {
    setEditingRecipe(recipe)
    setRecipeName(recipe.name)
    setCategory(recipe.category)
    setExpectedYield(recipe.expectedYield.toString())
    setYieldUnit(recipe.yieldUnit)
    setPreparationTime(recipe.preparationTime.toString())
    setInstructions(recipe.instructions)
    setIngredients([...recipe.ingredients])
    setFormError("")
    setMode("edit")
  }

  function duplicateRecipe(recipe: Recipe) {
    setRecipeName(`${recipe.name} (copia)`)
    setCategory(recipe.category)
    setExpectedYield(recipe.expectedYield.toString())
    setYieldUnit(recipe.yieldUnit)
    setPreparationTime(recipe.preparationTime.toString())
    setInstructions(recipe.instructions)
    setIngredients([...recipe.ingredients])
    setFormError("")
    setMode("add")
  }

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = categoryFilter === "Todos" || r.category === categoryFilter
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? r.active : !r.active)
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [recipes, searchQuery, categoryFilter, statusFilter])

  const sortedRecipes = [...filteredRecipes].sort((a, b) => a.name.localeCompare(b.name))

  const availableProducts = useMemo(() => {
    return stockItems.filter(s => s.currentStock > 0).sort((a, b) => a.productName.localeCompare(b.productName))
  }, [stockItems])

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setMode("list"); resetForm() } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="size-5 text-primary" />
              Gerenciar Receitas
            </DialogTitle>
            <DialogDescription>
              Crie e gerencie receitas com ingredientes e custos.
            </DialogDescription>
          </DialogHeader>

          {mode === "list" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center gap-2">
                <Button
                  size="sm" className="gap-1.5"
                  onClick={() => { resetForm(); setMode("add") }}
                >
                  <Plus className="size-4" /> Nova Receita
                </Button>
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar receitas..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todas Categorias</SelectItem>
                    {RECIPE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as Parameters<typeof setStatusFilter>[0])}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="active">Ativas</SelectItem>
                    <SelectItem value="inactive">Inativas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-1">
                {sortedRecipes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma receita encontrada
                  </p>
                ) : (
                  sortedRecipes.map((recipe) => {
                    const availability = checkAvailability()
                    const totalCost = recipe.ingredients.reduce((sum, ing) => sum + ing.cost, 0)
                    const costPerUnit = totalCost / recipe.expectedYield
                    return (
                      <div
                        key={recipe.id}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                          recipe.active ? "bg-card" : "bg-muted/50 opacity-60"
                        }`}
                      >
                        <div className="flex flex-1 flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{recipe.name}</span>
                            <Badge variant="outline" className="text-xs">{recipe.category}</Badge>
                            {!recipe.active && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                            <Badge variant="outline" className="text-xs">v{recipe.version}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <DollarSign className="size-3" />
                              Custo: R$ {totalCost.toFixed(2)} (R$ {costPerUnit.toFixed(2)}/{recipe.yieldUnit})
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {recipe.preparationTime} min
                            </span>
                            <span>
                              Rende: {recipe.expectedYield} {recipe.yieldUnit}
                            </span>
                            <span>
                              {recipe.ingredients.length} {recipe.ingredients.length === 1 ? "ingrediente" : "ingredientes"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm" variant="ghost"
                            className="size-8 p-0"
                            onClick={() => duplicateRecipe(recipe)}
                            title="Duplicar"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="size-8 p-0"
                            onClick={() => openEdit(recipe)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="size-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(recipe)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {(mode === "add" || mode === "edit") && (
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[600px] pr-2">
              <Accordion type="multiple" defaultValue={["basic", "ingredients"]} className="w-full">
                <AccordionItem value="basic">
                  <AccordionTrigger>Dados Basicos</AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="recipeName">Nome da Receita *</Label>
                        <Input
                          id="recipeName"
                          value={recipeName}
                          onChange={e => setRecipeName(e.target.value)}
                          placeholder="Ex: Bolo de Chocolate"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="category">Categoria *</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger id="category">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {RECIPE_CATEGORIES.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="expectedYield">Rendimento *</Label>
                        <Input
                          id="expectedYield"
                          type="number"
                          min="0"
                          step="0.01"
                          value={expectedYield}
                          onChange={e => setExpectedYield(e.target.value)}
                          placeholder="Ex: 10"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="yieldUnit">Unidade *</Label>
                        <Select value={yieldUnit} onValueChange={(v: StockUnit) => setYieldUnit(v)}>
                          <SelectTrigger id="yieldUnit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STOCK_UNITS.map(unit => (
                              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="preparationTime">Tempo (min) *</Label>
                        <Input
                          id="preparationTime"
                          type="number"
                          min="1"
                          value={preparationTime}
                          onChange={e => setPreparationTime(e.target.value)}
                          placeholder="Ex: 45"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="instructions">Modo de Preparo</Label>
                      <Textarea
                        id="instructions"
                        value={instructions}
                        onChange={e => setInstructions(e.target.value)}
                        placeholder="Descreva o passo a passo..."
                        rows={4}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="ingredients">
                  <AccordionTrigger>Ingredientes ({ingredients.length})</AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 flex flex-col gap-2">
                        <Label htmlFor="product">Produto</Label>
                        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                          <SelectTrigger id="product">
                            <SelectValue placeholder="Selecione um produto..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProducts.map(p => (
                              <SelectItem key={p.productId} value={p.productId}>
                                {p.productName} (Estoque: {p.currentStock} {p.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-32 flex flex-col gap-2">
                        <Label htmlFor="quantity">Quantidade</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="0"
                          step="0.01"
                          value={ingredientQuantity}
                          onChange={e => setIngredientQuantity(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="w-24 flex flex-col gap-2">
                        <Label htmlFor="unit">Unidade</Label>
                        <Select value={ingredientUnit} onValueChange={(v: StockUnit) => setIngredientUnit(v)}>
                          <SelectTrigger id="unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STOCK_UNITS.map(unit => (
                              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={addIngredient} size="sm">
                        <Plus className="size-4" />
                      </Button>
                    </div>

                    {ingredients.length > 0 && (
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ingrediente</TableHead>
                              <TableHead className="text-right">Quantidade</TableHead>
                              <TableHead className="text-right">Custo</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ingredients.map((ing) => (
                              <TableRow key={ing.productId}>
                                <TableCell>{ing.productName}</TableCell>
                                <TableCell className="text-right">
                                  {ing.quantity} {ing.unit}
                                </TableCell>
                                <TableCell className="text-right">
                                  R$ {ing.cost.toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="size-8 p-0 text-destructive"
                                    onClick={() => removeIngredient(ing.productId)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="summary">
                  <AccordionTrigger>Resumo de Custos</AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Custo Total:</span>
                        <span className="font-medium">R$ {totalCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Custo por {yieldUnit}:</span>
                        <span className="font-medium">R$ {costPerUnit.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex items-start gap-2 text-sm">
                        {(() => {
                          const { available, missing } = checkAvailability()
                          return available ? (
                            <div className="flex items-center gap-2 text-green-600">
                              <span className="font-medium">✓ Todos ingredientes disponiveis</span>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2 text-orange-600">
                              <AlertTriangle className="size-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium">Ingredientes insuficientes:</p>
                                <p className="text-xs">{missing.join(", ")}</p>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            {mode === "list" && (
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            )}
            {mode === "add" && (
              <>
                <Button variant="outline" onClick={() => { setMode("list"); resetForm() }}>
                  Cancelar
                </Button>
                <Button onClick={handleAdd}>Adicionar Receita</Button>
              </>
            )}
            {mode === "edit" && (
              <>
                <Button variant="outline" onClick={() => { setMode("list"); resetForm() }}>
                  Cancelar
                </Button>
                <Button onClick={handleEdit}>Salvar Alteracoes</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={v => { if (!v) { setDeleteConfirm(null); setHardDelete(false) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar a receita &quot;{deleteConfirm?.name}&quot;?
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                Nota: Exclusao permanente de receitas nao e permitida para preservar historico de producoes.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm, false)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
