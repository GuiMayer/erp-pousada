/**
 * Employee Repository
 * 
 * Manages employee data.
 */

import { BaseRepository } from "@/lib/data/repositories/base-repository"
import type { Employee } from "@/lib/store"
import type { IStorageAdapter } from "@/lib/data/types"
import { validateEmployee } from "@/lib/utils/validators"

export class EmployeeRepository extends BaseRepository<Employee> {
  constructor(adapter: IStorageAdapter, userId?: string) {
    super(adapter, "employees", { cacheEnabled: true, userId })
  }

  protected generateId(items: Employee[]): string {
    return `emp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  protected validate(employee: Partial<Employee>): { valid: boolean; error?: string } {
    return validateEmployee(employee)
  }

  /**
   * Find employee by CPF
   */
  async findByCPF(cpf: string): Promise<Employee | null> {
    const employees = await this.getAll()
    return employees.find(e => e.cpf === cpf) ?? null
  }

  /**
   * Find employees by name
   */
  async searchByName(query: string): Promise<Employee[]> {
    const employees = await this.getAll()
    const searchTerm = query.toLowerCase()
    return employees.filter(e => 
      e.name.toLowerCase().includes(searchTerm)
    )
  }

  /**
   * Find active employees
   */
  async findActive(): Promise<Employee[]> {
    return this.query({ active: true } as Partial<Employee>)
  }
}
