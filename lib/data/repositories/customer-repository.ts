/**
 * Customer Repository
 *
 * Manages customer data with validation.
 */

import { BaseRepository } from "./base-repository"
import type { Customer } from "../../store"
import type { IStorageAdapter } from "../types"
import { validateCpfCnpj, normalizeDocument, isCPF } from "../../utils/cpf-cnpj-validator"

export class CustomerRepository extends BaseRepository<Customer> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "customers", { cacheEnabled: true, userId })
  }

  protected generateId(): string {
    return crypto.randomUUID()
  }

  protected validate(customer: Partial<Customer>): { valid: boolean; error?: string } {
    if (customer.roles !== undefined && (!Array.isArray(customer.roles) || !customer.roles.length || customer.roles.some(r => !["guest", "payer", "supplier"].includes(r)))) return { valid: false, error: "Selecione um papel válido" }
    if (customer.roles?.includes("guest") && customer.cpfCnpj !== undefined && !isCPF(customer.cpfCnpj)) return { valid: false, error: "Hóspede precisa de CPF válido" }
    if (customer.name !== undefined && customer.name.trim() === "") {
      return { valid: false, error: "Nome do cliente é obrigatório" }
    }
    if (customer.cpfCnpj !== undefined) {
      if (customer.cpfCnpj.trim() === "" && (customer.roles ?? ["payer"]).some(r => r !== "supplier")) {
        return { valid: false, error: "CPF/CNPJ é obrigatório" }
      }
      if (customer.cpfCnpj && !validateCpfCnpj(customer.cpfCnpj)) {
        return { valid: false, error: "CPF/CNPJ inválido" }
      }
    }
    return { valid: true }
  }

  /**
   * Override create to add timestamps
   */
  async create(item: Partial<Customer>): Promise<Customer> {
    const document = normalizeDocument(item.cpfCnpj ?? "")
    if (!this.getItemAdapter() && document && (await this.getAll()).some(c => normalizeDocument(c.cpfCnpj) === document)) throw new Error("Documento já cadastrado; utilize a pessoa existente")
    const now = new Date().toISOString()
    const itemWithTimestamps = {
      ...item,
      cpfCnpj: document, roles: item.roles ?? ["payer"],
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
    if (!this.getItemAdapter()) {
      const current = await this.getById(id)
      const valid = this.validate({ ...current, ...updates })
      if (!valid.valid) throw new Error(valid.error)
    }
    if (updates.cpfCnpj !== undefined) {
      updates = { ...updates, cpfCnpj: normalizeDocument(updates.cpfCnpj) }
      if (!this.getItemAdapter() && updates.cpfCnpj && (await this.getAll()).some(c => c.id !== id && normalizeDocument(c.cpfCnpj) === updates.cpfCnpj)) throw new Error("Documento já cadastrado")
    }
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
    return (await this.getAll()).find(c => normalizeDocument(c.cpfCnpj) === normalizeDocument(cpfCnpj)) ?? null
  }
}
