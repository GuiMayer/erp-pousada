/**
 * POS Product Repository
 * 
 * Manages POS product catalog.
 */

import { BaseRepository } from "./base-repository"
import type { POSProduct } from "../../store"
import type { IStorageAdapter } from "../types"

export class POSProductRepository extends BaseRepository<POSProduct> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "posProducts", { cacheEnabled: true, userId })
  }

  protected generateId(items: POSProduct[]): string {
    return `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find products by category
   */
  async findByCategory(category: string): Promise<POSProduct[]> {
    return this.query({ category } as Partial<POSProduct>)
  }

  /**
   * Find product by barcode
   */
  async findByBarcode(barcode: string): Promise<POSProduct | null> {
    const products = await this.getAll()
    return products.find(p => p.barcode === barcode) ?? null
  }

  /**
   * Find products that track stock
   */
  async findStockTracked(): Promise<POSProduct[]> {
    return this.query({ trackStock: true } as Partial<POSProduct>)
  }

  /**
   * Search products by name
   */
  async searchByName(query: string): Promise<POSProduct[]> {
    const products = await this.getAll()
    const searchTerm = query.toLowerCase()
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm)
    )
  }
}
