/**
 * Recipe Repository
 * 
 * Manages recipe data for production.
 */

import { BaseRepository } from "@/lib/data/repositories/base-repository"
import type { Recipe } from "@/lib/store"
import type { IStorageAdapter } from "@/lib/data/types"
import { validateRecipe } from "@/lib/utils/validators"

export class RecipeRepository extends BaseRepository<Recipe> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "recipes", { cacheEnabled: true, userId })
  }

  protected generateId(items: Recipe[]): string {
    return `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  protected validate(recipe: Partial<Recipe>): { valid: boolean; error?: string } {
    return validateRecipe(recipe)
  }

  /**
   * Search recipes by name
   */
  async searchByName(query: string): Promise<Recipe[]> {
    const recipes = await this.getAll()
    const searchTerm = query.toLowerCase()
    return recipes.filter(r => 
      r.name.toLowerCase().includes(searchTerm)
    )
  }

  /**
   * Find recipes that use a specific ingredient
   */
  async findByIngredient(stockItemId: string): Promise<Recipe[]> {
    const recipes = await this.getAll()
    return recipes.filter(r => 
      r.ingredients.some(ing => ing.productId === stockItemId)
    )
  }
}
