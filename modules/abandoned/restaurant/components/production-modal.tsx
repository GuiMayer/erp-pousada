"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useProduction } from "@/modules/abandoned/restaurant/hooks/useProduction"
import { ChefHat, AlertTriangle, CheckCircle2, Search } from "lucide-react"
import type { Recipe, Production } from "@/lib/store"

type RecipeView = Recipe & { totalCost: number; unitCost: number; yield: number }

interface Props {
  open: boolean
  onClose: () => void
}

export function ProductionModal({ open, onClose }: Props) {
  const { recipes, stockItems, addProduction, updateStockItem, addAuditEntry } = useApp()
  const { username } = useAuth()
  const { checkIngredientsAvailability, registerProduction } = useProduction()

  const [step, setStep] = useState<"select" | "details" | "confirm">("select")
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeView | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [plannedQuantity, setPlannedQuantity] = useState("1")
  const [producedQuantity, setProducedQuantity] = useState("")
  const [notes, setNotes] = useState("")
  const [formError, setFormError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)

  const activeRecipes = useMemo(
    () => recipes.filter(r => r.active).map(r => { const cost = r.ingredients.reduce((sum,i) => sum + i.cost,0); return { ...r, totalCost: cost, unitCost: r.expectedYield ? cost / r.expectedYield : 0, yield: r.expectedYield } }),
    [recipes]
  )

  const filteredRecipes = useMemo(() => {
    if (!searchQuery) return activeRecipes
    const query = searchQuery.toLowerCase()
    return activeRecipes.filter(
      r =>
        r.name.toLowerCase().includes(query) ||
        r.category.toLowerCase().includes(query)
    )
  }, [activeRecipes, searchQuery])

  const availability = useMemo(() => {
    if (!selectedRecipe) return null
    const qty = parseFloat(plannedQuantity) || 1
    const result = checkIngredientsAvailability(selectedRecipe.id, qty)
    return { ...result, warnings: result.missing }
  }, [selectedRecipe, plannedQuantity, checkIngredientsAvailability])

  function resetForm() {
    setStep("select")
    setSelectedRecipe(null)
    setSearchQuery("")
    setPlannedQuantity("1")
    setProducedQuantity("")
    setNotes("")
    setFormError("")
  }

  function handleSelectRecipe(recipe: RecipeView) {
    setSelectedRecipe(recipe)
    setStep("details")
    setFormError("")
  }

  function handleNext() {
    const planned = parseFloat(plannedQuantity)
    const produced = parseFloat(producedQuantity)

    if (isNaN(planned) || planned <= 0) {
      setFormError("Quantidade planejada inválida")
      return
    }

    if (isNaN(produced) || produced <= 0) {
      setFormError("Quantidade produzida inválida")
      return
    }

    if (!availability?.available) {
      setFormError("Ingredientes insuficientes no estoque")
      return
    }

    setFormError("")
    setConfirmOpen(true)
  }

  async function handleConfirm() {
    if (!selectedRecipe || !availability) return
    const result = await registerProduction(selectedRecipe.id, Number(plannedQuantity), Number(producedQuantity), username || "sistema", notes || undefined)
    if (!result.success) { setFormError(result.error || "Produção não concluída"); return }
    setConfirmOpen(false); resetForm(); onClose()
  }

  const totalCost = selectedRecipe
    ? selectedRecipe.totalCost * (parseFloat(plannedQuantity) || 1)
    : 0

  const unitCost =
    selectedRecipe && producedQuantity
      ? totalCost / parseFloat(producedQuantity)
      : 0

  const yieldPercent =
    plannedQuantity && producedQuantity
      ? (parseFloat(producedQuantity) / parseFloat(plannedQuantity)) * 100
      : 0

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={v => {
          if (!v) {
            resetForm()
            onClose()
          }
        }}
      >
        <DialogContent mobileTask protectDraft className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              Registrar Produção
            </DialogTitle>
            <DialogDescription>
              {step === "select" && "Selecione a receita a ser produzida"}
              {step === "details" && "Informe os detalhes da produção"}
              {step === "confirm" && "Confirme os dados da produção"}
            </DialogDescription>
          </DialogHeader>

          {step === "select" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar receita..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                {filteredRecipes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {searchQuery
                      ? "Nenhuma receita encontrada"
                      : "Nenhuma receita ativa cadastrada"}
                  </p>
                ) : (
                  filteredRecipes.map(recipe => {
                    const recipeAvailability = checkIngredientsAvailability(recipe.id, 1)

                    return (
                      <button
                        key={recipe.id}
                        onClick={() => handleSelectRecipe(recipe)}
                        className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3 text-left hover:bg-secondary transition-colors"
                      >
                        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {recipe.name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {recipe.category}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              Custo: R$ {recipe.totalCost.toFixed(2)}
                            </span>
                            <span>•</span>
                            <span>
                              Rendimento: {recipe.yield} {recipe.yieldUnit}
                            </span>
                            <span>•</span>
                            <span>{recipe.ingredients.length} ingredientes</span>
                          </div>

                          {!recipeAvailability.available && (
                            <div className="flex items-center gap-1 text-xs text-orange-600">
                              <AlertTriangle className="h-3 w-3" />
                              <span>Ingredientes insuficientes</span>
                            </div>
                          )}
                        </div>

                        {recipeAvailability.available && (
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {step === "details" && selectedRecipe && (
            <div className="flex flex-col gap-4 overflow-y-auto pr-1">
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {formError}
                </div>
              )}

              <div className="rounded-lg bg-secondary/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-foreground">
                    {selectedRecipe.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {selectedRecipe.category}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Rendimento: {selectedRecipe.yield} {selectedRecipe.yieldUnit} •
                  Custo unitário: R$ {selectedRecipe.unitCost.toFixed(2)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="planned">Quantidade Planejada *</Label>
                  <Input
                    id="planned"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={plannedQuantity}
                    onChange={e => {
                      setPlannedQuantity(e.target.value)
                      setFormError("")
                    }}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Múltiplo da receita base
                  </p>
                </div>

                <div>
                  <Label htmlFor="produced">Quantidade Produzida *</Label>
                  <Input
                    id="produced"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={producedQuantity}
                    onChange={e => {
                      setProducedQuantity(e.target.value)
                      setFormError("")
                    }}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quantidade real obtida
                  </p>
                </div>
              </div>

              {availability && (
                <div
                  className={`rounded-lg p-3 ${
                    availability.available
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {availability.available ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-900">
                          Ingredientes disponíveis
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-900">
                          Ingredientes insuficientes
                        </span>
                      </>
                    )}
                  </div>

                  {!availability.available && availability.missing.length > 0 && (
                    <div className="text-xs text-red-800 space-y-1">
                      {availability.missing.map((item, idx) => (
                        <div key={idx}>
                          • {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {producedQuantity && plannedQuantity && (
                <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
                  <div className="text-sm font-medium">Resumo</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Custo Total:</span>
                      <div className="font-medium">R$ {totalCost.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Custo Unitário:</span>
                      <div className="font-medium">R$ {unitCost.toFixed(2)}</div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Rendimento:</span>
                      <div
                        className={`font-medium ${
                          yieldPercent < 90
                            ? "text-orange-600"
                            : yieldPercent > 110
                            ? "text-blue-600"
                            : "text-green-600"
                        }`}
                      >
                        {yieldPercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Adicione observações sobre a produção..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {step === "select" && (
              <Button onClick={onClose}>Cancelar</Button>
            )}

            {step === "details" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("select")
                    setFormError("")
                  }}
                >
                  Voltar
                </Button>
                <Button onClick={handleNext} disabled={!availability?.available}>
                  Continuar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Produção</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá deduzir os ingredientes do estoque. Confirme os dados:
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedRecipe && (
            <div className="space-y-3 py-2">
              <div>
                <span className="text-sm font-medium">Receita:</span>
                <div className="text-sm text-muted-foreground">
                  {selectedRecipe.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm font-medium">Planejado:</span>
                  <div className="text-sm text-muted-foreground">
                    {plannedQuantity} unidades
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium">Produzido:</span>
                  <div className="text-sm text-muted-foreground">
                    {producedQuantity} unidades
                  </div>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium">Custo Total:</span>
                <div className="text-sm text-muted-foreground">
                  R$ {totalCost.toFixed(2)}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium">Rendimento:</span>
                <div
                  className={`text-sm font-medium ${
                    yieldPercent < 90
                      ? "text-orange-600"
                      : yieldPercent > 110
                      ? "text-blue-600"
                      : "text-green-600"
                  }`}
                >
                  {yieldPercent.toFixed(1)}%
                </div>
              </div>

              {availability && availability.warnings.length > 0 && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-900">
                      Alertas de Estoque
                    </span>
                  </div>
                  <div className="text-xs text-orange-800 space-y-1">
                    {availability.warnings.map((warning, idx) => (
                      <div key={idx}>• {warning}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirmar Produção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
