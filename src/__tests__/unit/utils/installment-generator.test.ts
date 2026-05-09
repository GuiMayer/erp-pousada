import { describe, it, expect } from 'vitest'
import { generateInstallments } from '@/lib/utils/installment-generator'

describe('installment-generator', () => {
  describe('generateInstallments', () => {
    it('should generate single installment when installments is 1', () => {
      const result = generateInstallments({
        totalValue: 1000,
        firstDueDate: '2026-05-15',
        numberOfInstallments: 1,
        intervalDays: 30
      })

      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(1000)
      expect(result[0].dueDate).toBe('2026-05-15')
      expect(result[0].installmentNumber).toBe(1)
      expect(result[0].paid).toBe(false)
    })

    it('should generate multiple installments with equal values', () => {
      const result = generateInstallments({
        totalValue: 900,
        firstDueDate: '2026-05-15',
        numberOfInstallments: 3,
        intervalDays: 30
      })

      expect(result).toHaveLength(3)
      expect(result[0].value).toBe(300)
      expect(result[1].value).toBe(300)
      expect(result[2].value).toBe(300)
    })

    it('should distribute remainder to first installment when division is not exact', () => {
      const result = generateInstallments({
        totalValue: 1000,
        firstDueDate: '2026-05-15',
        numberOfInstallments: 3,
        intervalDays: 30
      })

      expect(result).toHaveLength(3)
      expect(result[0].value).toBe(333.34) // Gets the extra cents
      expect(result[1].value).toBe(333.33)
      expect(result[2].value).toBe(333.33)
      
      // Verify total sum equals original value
      const total = result.reduce((sum, inst) => sum + inst.value, 0)
      expect(total).toBeCloseTo(1000, 2)
    })

    it('should calculate correct due dates with 30-day interval', () => {
      const result = generateInstallments({
        totalValue: 900,
        firstDueDate: '2026-05-15',
        numberOfInstallments: 3,
        intervalDays: 30
      })

      expect(result[0].dueDate).toBe('2026-05-15')
      expect(result[1].dueDate).toBe('2026-06-14')
      expect(result[2].dueDate).toBe('2026-07-14')
    })

    it('should calculate correct due dates with custom interval', () => {
      const result = generateInstallments({
        totalValue: 600,
        firstDueDate: '2026-05-15',
        numberOfInstallments: 2,
        intervalDays: 15
      })

      expect(result[0].dueDate).toBe('2026-05-15')
      expect(result[1].dueDate).toBe('2026-05-30')
    })

    it('should generate unique IDs for each installment', () => {
      const result = generateInstallments({
        totalValue: 900,
        firstDueDate: '2026-05-15',
        numberOfInstallments: 3,
        intervalDays: 30
      })

      const ids = result.map(inst => inst.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3)
      
      // Verify ID format
      ids.forEach(id => {
        expect(id).toMatch(/^EI-\d+-[a-z0-9]{4}$/)
      })
    })

    it('should set all installments as unpaid by default', () => {
      const result = generateInstallments({
        totalValue: 900,
        firstDueDate: '2026-05-15',
        numberOfInstallments: 3,
        intervalDays: 30
      })

      result.forEach(inst => {
        expect(inst.paid).toBe(false)
      })
    })

    it('should handle large number of installments', () => {
      const result = generateInstallments({
        totalValue: 12000,
        firstDueDate: '2026-05-15',
        numberOfInstallments: 12,
        intervalDays: 30
      })

      expect(result).toHaveLength(12)
      expect(result[0].installmentNumber).toBe(1)
      expect(result[11].installmentNumber).toBe(12)
      
      // Verify total sum
      const total = result.reduce((sum, inst) => sum + inst.value, 0)
      expect(total).toBeCloseTo(12000, 2)
    })

    it('should handle edge case with very small values', () => {
      const result = generateInstallments({
        totalValue: 1,
        firstDueDate: '2026-05-15',
        numberOfInstallments: 3,
        intervalDays: 30
      })

      expect(result).toHaveLength(3)
      
      // Verify total sum equals original value
      const total = result.reduce((sum, inst) => sum + inst.value, 0)
      expect(total).toBeCloseTo(1, 2)
    })
  })
})
