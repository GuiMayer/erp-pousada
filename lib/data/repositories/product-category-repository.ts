/**
 * Product Category Repository
 * 
 * Manages product categories for POS and restaurant.
 */

import { BaseRepository } from "./base-repository"
import type { ProductCategory } from "../../store"
import type { IStorageAdapter } from "../types"

export class ProductCategoryRepository extends BaseRepository<ProductCategory> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "productCategories", { cacheEnabled: true, userId })
  }

  protected generateId(items: ProductCategory[]): string {
    return `pcat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find category by name
   */
  async findByName(name: string): Promise<ProductCategory | null> {
    const categories = await this.getAll()
    return categories.find(c => c.name === name) ?? null
  }
}
