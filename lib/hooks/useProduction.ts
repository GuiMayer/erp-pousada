import { useCallback, useMemo } from "react"
import { useApp } from "../app-context"
import type { Recipe, Production, RecipeIngredient } from "../store"
import { useStockControl } from "./useStockControl"
import { generateProductionId } from "../utils/id-generators"

/**
 * Hook for managing recipe production
 * Provides utilities for creating recipes and registering production
 */
export function useProduction() {
  const {
    recipes,
    productions,
    addRecipe,
    updateRecipe,
    addProduction,
    posProducts,
  } = useApp()

  const { hasStock, registerMovement, getStockByProduct } = useStockControl()

  // Get active recipes
  const activeRecipes = useMemo(() => {
    return recipes.filter(r => r.active)
  }, [recipes])

  // Calculate recipe cost
  const calculateRecipeCost = useCallback((ingredients: RecipeIngredient[]): number => {
    return ingredients.reduce((sum, ing) => sum + ing.cost, 0)
  }, [])

  // Check if all ingredients are available
  const checkIngredientsAvailability = useCallback((
    recipeId: string,
    quantity: number
  ): { available: boolean; missing: string[] } => {
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) return { available: false, missing: [] }

    const missing: string[] = []

    for (const ingredient of recipe.ingredients) {
      const requiredQuantity = ingredient.quantity * quantity
      if (!hasStock(ingredient.productId, requiredQuantity)) {
        missing.push(ingredient.productName)
      }
    }

    return {
      available: missing.length === 0,
      missing,
    }
  }, [recipes, hasStock])

  // Register production and deduct ingredients from stock
  const registerProduction = useCallback((
    recipeId: string,
    plannedQuantity: number,
    producedQuantity: number,
    producedBy: string,
    notes?: string
  ): { success: boolean; error?: string } => {
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) {
      return { success: false, error: "Receita não encontrada" }
    }

    // Check ingredients availability
    const { available, missing } = checkIngredientsAvailability(recipeId, plannedQuantity)
    if (!available) {
      return {
        success: false,
        error: `Ingredientes insuficientes: ${missing.join(", ")}`,
      }
    }

    // Calculate costs
    const totalCost = calculateRecipeCost(recipe.ingredients) * plannedQuantity
    const unitCost = producedQuantity > 0 ? totalCost / producedQuantity : 0
    const yieldPercentage = (producedQuantity / (recipe.expectedYield * plannedQuantity)) * 100

    // Create production record
    const production: Production = {
      id: generateProductionId(),
      recipeId,
      recipeName: recipe.name,
      plannedQuantity,
      producedQuantity,
      yield: yieldPercentage,
      totalCost,
      unitCost,
      timestamp: new Date().toISOString(),
      producedBy,
      notes,
    }

    addProduction(production)

    // Deduct ingredients from stock
    for (const ingredient of recipe.ingredients) {
      const quantityToDeduct = ingredient.quantity * plannedQuantity
      registerMovement(
        "saida",
        ingredient.productId,
        quantityToDeduct,
        `Produção: ${recipe.name}`,
        producedBy,
        undefined,
        undefined,
        undefined,
        `Produção ID: ${production.id}`
      )
    }

    return { success: true }
  }, [recipes, checkIngredientsAvailability, calculateRecipeCost, addProduction, registerMovement])

  // Get production history
  const getProductionHistory = useCallback((limit?: number) => {
    const sorted = productions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    return limit ? sorted.slice(0, limit) : sorted
  }, [productions])

  // Get production by recipe
  const getProductionByRecipe = useCallback((recipeId: string) => {
    return productions
      .filter(p => p.recipeId === recipeId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [productions])

  // Calculate average yield for a recipe
  const getAverageYield = useCallback((recipeId: string): number => {
    const recipeProductions = getProductionByRecipe(recipeId)
    if (recipeProductions.length === 0) return 0

    const totalYield = recipeProductions.reduce((sum, p) => sum + p.yield, 0)
    return totalYield / recipeProductions.length
  }, [getProductionByRecipe])

  // Get production statistics
  const stats = useMemo(() => {
    const totalProductions = productions.length
    const totalCost = productions.reduce((sum, p) => sum + p.totalCost, 0)
    const averageYield = totalProductions > 0
      ? productions.reduce((sum, p) => sum + p.yield, 0) / totalProductions
      : 0

    return {
      totalProductions,
      totalCost,
      averageYield,
    }
  }, [productions])

  return {
    recipes: activeRecipes,
    allRecipes: recipes,
    productions,
    calculateRecipeCost,
    checkIngredientsAvailability,
    registerProduction,
    getProductionHistory,
    getProductionByRecipe,
    getAverageYield,
    stats,
    addRecipe,
    updateRecipe,
  }
}
