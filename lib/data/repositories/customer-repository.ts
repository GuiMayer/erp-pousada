/**
 * Customer Repository
 *
 * Manages customer data with validation.
 */

import { BaseRepository } from "./base-repository"
import type { Customer } from "../../store"
import type { IStorageAdapter } from "../types"
import { generateCustomerId } from "../../utils/id-generators"
import { validateCpfCnpj } from "../../utils/cpf-cnpj-validator"

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
    if (customer.cpfCnpj !== undefined) {
      if (customer.cpfCnpj.trim() === "") {
        return { valid: false, error: "CPF/CNPJ é obrigatório" }
      }
      if (!validateCpfCnpj(customer.cpfCnpj)) {
        return { valid: false, error: "CPF/CNPJ inválido" }
      }
    }
    return { valid: true }
  }

  /**
   * Override create to add timestamps
   */
  async create(item: Partial<Customer>): Promise<Customer> {
    const now = new Date().toISOString()
    const itemWithTimestamps = {
      ...item,
      createdAt: now,
      updatedAt: now,
      active: item.active !== undefined ? item.active : true
    }
    return super.create(itemWithTimestamps as Customer)
  }

  /**
   * Override update to update timestamp
   */
  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString()
    }
    return super.update(id, updatesWithTimestamp)
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
