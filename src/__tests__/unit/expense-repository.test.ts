/**
 * Expense Repository Tests
 * 
 * Tests for expense repository with installment support
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ExpenseRepository } from '../../../lib/data/repositories/expense-repository'
import type { Expense, ExpenseInstallment } from '../../../lib/store'
import type { IStorageAdapter } from '../../../lib/data/types'
import { generateInstallments } from '../../../lib/utils/installment-generator'

/**
 * Simple in-memory storage adapter for testing
 */
class MockStorageAdapter implements IStorageAdapter {
  private storage: Map<string, any> = new Map()

  async get<T>(key: string): Promise<T | null> {
    return this.storage.get(key) ?? null
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.storage.set(key, value)
  }

  async remove(key: string): Promise<void> {
    this.storage.delete(key)
  }

  async clear(): Promise<void> {
    this.storage.clear()
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys())
  }

  async getStorageSize(): Promise<number> {
    return this.storage.size
  }
}

describe('ExpenseRepository', () => {
  let repository: ExpenseRepository
  let adapter: MockStorageAdapter

  beforeEach(() => {
    adapter = new MockStorageAdapter()
    repository = new ExpenseRepository(adapter, 'test-user')
  })

  describe('Basic CRUD Operations', () => {
    it('should create an expense without installments', async () => {
      const expense: Partial<Expense> = {
        description: 'Office Supplies',
        amount: 500,
        category: 'Supplies',
        dueDate: '2024-06-15',
        paid: false,
        paymentMethod: 'credit'
      }

      const created = await repository.create(expense as Expense)
      const retrieved = await repository.getById(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.description).toBe('Office Supplies')
      expect(retrieved?.amount).toBe(500)
    })

    it('should update an expense', async () => {
      const expense: Partial<Expense> = {
        description: 'Internet Bill',
        amount: 200,
        category: 'Utilities',
        dueDate: '2024-06-20',
        paid: false,
        paymentMethod: 'debit'
      }

      const created = await repository.create(expense as Expense)
      await repository.update(created.id, { paid: true, paymentDate: '2024-06-20' })

      const updated = await repository.getById(created.id)
      expect(updated?.paid).toBe(true)
      expect(updated?.paymentDate).toBe('2024-06-20')
    })

    it('should delete an expense', async () => {
      const expense: Partial<Expense> = {
        description: 'Test Expense',
        amount: 100,
        category: 'Test',
        dueDate: '2024-06-25',
        paid: false,
        paymentMethod: 'cash'
      }

      const created = await repository.create(expense as Expense)
      await repository.delete(created.id)

      const retrieved = await repository.getById(created.id)
      expect(retrieved).toBeNull()
    })
  })

  describe('Query Operations', () => {
    let rentId: string
    let electricityId: string
    let waterId: string

    beforeEach(async () => {
      const rent = await repository.create({
        description: 'Rent',
        amount: 2000,
        category: 'Rent',
        dueDate: '2024-06-01',
        paid: true,
        paymentDate: '2024-06-01',
        paymentMethod: 'transfer'
      } as Expense)
      rentId = rent.id

      const electricity = await repository.create({
        description: 'Electricity',
        amount: 300,
        category: 'Utilities',
        dueDate: '2024-06-10',
        paid: false,
        paymentMethod: 'debit'
      } as Expense)
      electricityId = electricity.id

      const water = await repository.create({
        description: 'Water',
        amount: 150,
        category: 'Utilities',
        dueDate: '2024-05-15',
        paid: false,
        paymentMethod: 'debit'
      } as Expense)
      waterId = water.id
    })

    it('should find expenses by category', async () => {
      const utilities = await repository.findByCategory('Utilities')
      expect(utilities).toHaveLength(2)
      expect(utilities.every(e => e.category === 'Utilities')).toBe(true)
    })

    it('should find paid expenses', async () => {
      const paid = await repository.findPaid()
      expect(paid).toHaveLength(1)
      expect(paid[0].description).toBe('Rent')
    })

    it('should find unpaid expenses', async () => {
      const unpaid = await repository.findUnpaid()
      expect(unpaid).toHaveLength(2)
      expect(unpaid.every(e => !e.paid)).toBe(true)
    })

    it('should find overdue expenses', async () => {
      const overdue = await repository.findOverdue()
      expect(overdue.length).toBeGreaterThanOrEqual(1)
      expect(overdue.some(e => e.description === 'Water')).toBe(true)
    })

    it('should find expenses by date range', async () => {
      const inRange = await repository.findByDateRange('2024-06-01', '2024-06-15')
      expect(inRange).toHaveLength(2)
      const descriptions = inRange.map(e => e.description).sort()
      expect(descriptions).toEqual(['Electricity', 'Rent'])
    })
  })

  describe('Installment Operations', () => {
    it('should create an expense with installments', async () => {
      const installments = generateInstallments({
        totalValue: 1200,
        numberOfInstallments: 3,
        firstDueDate: '2024-06-01'
      })
      const expense: Partial<Expense> = {
        description: 'Equipment Purchase',
        amount: 1200,
        category: 'Equipment',
        dueDate: '2024-06-01',
        paid: false,
        paymentMethod: 'credit',
        installments
      }

      const created = await repository.create(expense as Expense)
      const retrieved = await repository.getById(created.id)

      expect(retrieved?.installments).toHaveLength(3)
      expect(retrieved?.installments?.[0].value).toBe(400)
      expect(retrieved?.installments?.every(i => !i.paid)).toBe(true)
    })

    it('should find expenses with installments', async () => {
      const installments = generateInstallments({
        totalValue: 900,
        numberOfInstallments: 3,
        firstDueDate: '2024-06-01'
      })
      const expense: Partial<Expense> = {
        description: 'Software License',
        amount: 900,
        category: 'Software',
        dueDate: '2024-06-01',
        paid: false,
        paymentMethod: 'credit',
        installments
      }

      const created = await repository.create(expense as Expense)
      const withInstallments = await repository.findWithInstallments()

      expect(withInstallments.length).toBeGreaterThanOrEqual(1)
      expect(withInstallments.some(e => e.id === created.id)).toBe(true)
    })

    it('should update a specific installment', async () => {
      const installments = generateInstallments({
        totalValue: 600,
        numberOfInstallments: 2,
        firstDueDate: '2024-06-01'
      })
      const expense: Partial<Expense> = {
        description: 'Consulting Services',
        amount: 600,
        category: 'Services',
        dueDate: '2024-06-01',
        paid: false,
        paymentMethod: 'credit',
        installments
      }

      const created = await repository.create(expense as Expense)
      const installmentId = installments[0].id

      await repository.updateInstallment(created.id, installmentId, {
        paid: true,
        paymentDate: '2024-06-01'
      })

      const updated = await repository.getById(created.id)
      expect(updated?.installments?.[0].paid).toBe(true)
      expect(updated?.installments?.[0].paymentDate).toBe('2024-06-01')
      expect(updated?.installments?.[1].paid).toBe(false)
    })

    it('should mark installment as paid', async () => {
      const installments = generateInstallments({
        totalValue: 900,
        numberOfInstallments: 3,
        firstDueDate: '2024-06-01'
      })
      const expense: Partial<Expense> = {
        description: 'Marketing Campaign',
        amount: 900,
        category: 'Marketing',
        dueDate: '2024-06-01',
        paid: false,
        paymentMethod: 'credit',
        installments
      }

      const created = await repository.create(expense as Expense)
      const installmentId = installments[0].id

      await repository.markInstallmentAsPaid(created.id, installmentId)

      const updated = await repository.getById(created.id)
      expect(updated?.installments?.[0].paid).toBe(true)
      expect(updated?.installments?.[0].paymentDate).toBeDefined()
    })

    it('should mark expense as paid when all installments are paid', async () => {
      const installments = generateInstallments({
        totalValue: 600,
        numberOfInstallments: 2,
        firstDueDate: '2024-06-01'
      })
      const expense: Partial<Expense> = {
        description: 'Training Course',
        amount: 600,
        category: 'Training',
        dueDate: '2024-06-01',
        paid: false,
        paymentMethod: 'credit',
        installments
      }

      const created = await repository.create(expense as Expense)

      // Pay first installment
      await repository.markInstallmentAsPaid(created.id, installments[0].id)
      let updated = await repository.getById(created.id)
      expect(updated?.paid).toBe(false)

      // Pay second installment
      await repository.markInstallmentAsPaid(created.id, installments[1].id)
      updated = await repository.getById(created.id)
      expect(updated?.paid).toBe(true)
      expect(updated?.paymentDate).toBeDefined()
    })

    it('should mark expense as unpaid when a paid installment is marked as unpaid', async () => {
      const installments = generateInstallments({
        totalValue: 600,
        numberOfInstallments: 2,
        firstDueDate: '2024-06-01'
      })
      const expense: Partial<Expense> = {
        description: 'Subscription',
        amount: 600,
        category: 'Services',
        dueDate: '2024-06-01',
        paid: false,
        paymentMethod: 'credit',
        installments
      }

      const created = await repository.create(expense as Expense)

      // Pay all installments
      await repository.markInstallmentAsPaid(created.id, installments[0].id)
      await repository.markInstallmentAsPaid(created.id, installments[1].id)

      let updated = await repository.getById(created.id)
      expect(updated?.paid).toBe(true)

      // Mark first installment as unpaid
      await repository.updateInstallment(created.id, installments[0].id, {
        paid: false,
        paymentDate: undefined
      })

      updated = await repository.getById(created.id)
      expect(updated?.paid).toBe(false)
      expect(updated?.paymentDate).toBeUndefined()
    })

    it('should get all installments across all expenses', async () => {
      const expense1: Partial<Expense> = {
        description: 'Equipment A',
        amount: 600,
        category: 'Equipment',
        dueDate: '2024-06-01',
        paid: false,
        paymentMethod: 'credit',
        installments: generateInstallments({
          totalValue: 600,
          numberOfInstallments: 2,
          firstDueDate: '2024-06-01'
        })
      }

      const expense2: Partial<Expense> = {
        description: 'Equipment B',
        amount: 900,
        category: 'Equipment',
        dueDate: '2024-06-01',
        paid: false,
        paymentMethod: 'credit',
        installments: generateInstallments({
          totalValue: 900,
          numberOfInstallments: 3,
          firstDueDate: '2024-06-01'
        })
      }

      await repository.create(expense1 as Expense)
      await repository.create(expense2 as Expense)

      const allInstallments = await repository.getAllInstallments()
      expect(allInstallments.length).toBeGreaterThanOrEqual(5) // 2 + 3
      expect(allInstallments.every(i => i.expenseId && i.expenseDescription)).toBe(true)
    })

    it('should find overdue installments', async () => {
      const pastInstallments = generateInstallments({
        totalValue: 600,
        numberOfInstallments: 2,
        firstDueDate: '2024-05-01'
      })
      const futureInstallments = generateInstallments({
        totalValue: 600,
        numberOfInstallments: 2,
        firstDueDate: '2024-07-01'
      })

      const expense1: Partial<Expense> = {
        description: 'Past Due',
        amount: 600,
        category: 'Test',
        dueDate: '2024-05-01',
        paid: false,
        paymentMethod: 'credit',
        installments: pastInstallments
      }

      const expense2: Partial<Expense> = {
        description: 'Future Due',
        amount: 600,
        category: 'Test',
        dueDate: '2024-07-01',
        paid: false,
        paymentMethod: 'credit',
        installments: futureInstallments
      }

      const created1 = await repository.create(expense1 as Expense)
      await repository.create(expense2 as Expense)

      const overdueInstallments = await repository.findOverdueInstallments()
      expect(overdueInstallments.length).toBeGreaterThan(0)
      expect(overdueInstallments.some(i => i.expenseId === created1.id)).toBe(true)
    })

    it('should throw error when updating non-existent expense installment', async () => {
      await expect(
        repository.updateInstallment('NON-EXISTENT', 'INST-001', { paid: true })
      ).rejects.toThrow('Expense NON-EXISTENT not found')
    })

    it('should throw error when updating installment on expense without installments', async () => {
      const expense: Partial<Expense> = {
        description: 'No Installments',
        amount: 500,
        category: 'Test',
        dueDate: '2024-06-01',
        paid: false,
        paymentMethod: 'cash'
      }

      const created = await repository.create(expense as Expense)

      await expect(
        repository.updateInstallment(created.id, 'INST-001', { paid: true })
      ).rejects.toThrow('Expense ' + created.id + ' has no installments')
    })

    it('should throw error when updating non-existent installment', async () => {
      const installments = generateInstallments({
        totalValue: 600,
        numberOfInstallments: 2,
        firstDueDate: '2024-06-01'
      })
      const expense: Partial<Expense> = {
        description: 'Test',
        amount: 600,
        category: 'Test',
        dueDate: '2024-06-01',
        paid: false,
        paymentMethod: 'credit',
        installments
      }

      const created = await repository.create(expense as Expense)

      await expect(
        repository.updateInstallment(created.id, 'NON-EXISTENT', { paid: true })
      ).rejects.toThrow('Installment NON-EXISTENT not found in expense ' + created.id)
    })
  })

  describe('Validation', () => {
    it('should reject expense with invalid data', async () => {
      const invalidExpense = {
        description: '',
        amount: -100,
        category: 'Test',
        dueDate: 'invalid-date',
        paid: false,
        paymentMethod: 'cash'
      } as Expense

      await expect(repository.create(invalidExpense)).rejects.toThrow()
    })

    it('should accept expense with valid required fields', async () => {
      const validExpense = {
        description: 'Valid Expense',
        amount: 100,
        category: 'Test',
        dueDate: '2024-06-01',
        paid: false,
        paymentMethod: 'cash'
      } as Expense

      const created = await repository.create(validExpense)
      expect(created).toBeDefined()
      expect(created.description).toBe('Valid Expense')
    })
  })
})
