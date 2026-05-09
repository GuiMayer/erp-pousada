/**
 * Customer Repository
 * 
 * Manages customer data with validation.
 */

import { BaseRepository } from "./base-repository"
import type { Customer } from "../../store"
import type { IStorageAdapter } from "../types"
import { generateCustomerId } from "../../utils/id-generators"

export class CustomerRepository extends BaseRepository<Customer> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "customers", { cacheEnabled: true, userId })
  }

  protected generateId(items: Customer[]): string {
    return generateCustomerId(items.length)
  }

  protected validate(customer: Partial<Customer>): { valid: boolean; error?: string } {
    if (customer.name !== undefined && customer.name.trim() === "") {
      return { valid: false, error: "Nome do cliente é obrigatório" }
    }
    if (customer.cpfCnpj !== undefined && customer.cpfCnpj.trim() === "") {
      return { valid: false, error: "CPF/CNPJ é obrigatório" }
    }
    return { valid: true }
  }

  /**
   * Find active customers
   */
  async findActive(): Promise<Customer[]> {
    return this.query({ active: true } as Partial<Customer>)
  }

  /**
   * Find customer by CPF/CNPJ
   */
  async findByCpfCnpj(cpfCnpj: string): Promise<Customer | null> {
    const customers = await this.query({ cpfCnpj } as Partial<Customer>)
    return customers[0] ?? null
  }
}
