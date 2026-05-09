/**
 * Supplier Repository
 * 
 * Manages supplier data with validation.
 */

import { BaseRepository } from "./base-repository"
import type { Supplier } from "../../store"
import type { IStorageAdapter } from "../types"
import { generateSupplierId } from "../../utils/id-generators"

export class SupplierRepository extends BaseRepository<Supplier> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "suppliers", { cacheEnabled: true, userId })
  }

  protected generateId(items: Supplier[]): string {
    return generateSupplierId(items.length)
  }

  protected validate(supplier: Partial<Supplier>): { valid: boolean; error?: string } {
    if (supplier.name !== undefined && supplier.name.trim() === "") {
      return { valid: false, error: "Nome do fornecedor é obrigatório" }
    }
    return { valid: true }
  }

  /**
   * Find active suppliers
   */
  async findActive(): Promise<Supplier[]> {
    return this.query({ active: true } as Partial<Supplier>)
  }

  /**
   * Find supplier by CNPJ
   */
  async findByCnpj(cnpj: string): Promise<Supplier | null> {
    const suppliers = await this.query({ cnpj } as Partial<Supplier>)
    return suppliers[0] ?? null
  }
}
