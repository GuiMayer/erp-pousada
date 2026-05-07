import { describe, it, expect } from 'vitest'
import {
  generateReservationId,
  generateTransactionId,
  generateExpenseId,
  generateConsumptionItemId,
  generateSaleId,
  generateProductId,
  generateCashCloseId,
  generateAuditId,
  generateCategoryId,
  generateCartItemId,
} from '@/lib/utils/id-generators'

describe('ID Generators', () => {
  describe('generateReservationId', () => {
    it('should generate formatted reservation ID', () => {
      expect(generateReservationId(0)).toBe('R001')
      expect(generateReservationId(9)).toBe('R010')
      expect(generateReservationId(99)).toBe('R100')
    })
  })

  describe('generateTransactionId', () => {
    it('should generate transaction ID with timestamp', () => {
      const id = generateTransactionId()
      expect(id).toMatch(/^T\d+$/)
    })

    it('should generate unique IDs', async () => {
      const id1 = generateTransactionId()
      await new Promise(resolve => setTimeout(resolve, 2))
      const id2 = generateTransactionId()
      expect(id1).not.toBe(id2)
    })
  })

  describe('generateExpenseId', () => {
    it('should generate formatted expense ID', () => {
      expect(generateExpenseId(0)).toBe('E001')
      expect(generateExpenseId(9)).toBe('E010')
      expect(generateExpenseId(99)).toBe('E100')
    })
  })

  describe('generateConsumptionItemId', () => {
    it('should generate consumption item ID with timestamp and random suffix', () => {
      const id = generateConsumptionItemId()
      expect(id).toMatch(/^CI-\d+-[a-z0-9]{4}$/)
    })

    it('should generate unique IDs', () => {
      const id1 = generateConsumptionItemId()
      const id2 = generateConsumptionItemId()
      expect(id1).not.toBe(id2)
    })
  })

  describe('generateSaleId', () => {
    it('should generate formatted sale ID', () => {
      expect(generateSaleId(0)).toBe('V001')
      expect(generateSaleId(9)).toBe('V010')
      expect(generateSaleId(99)).toBe('V100')
    })
  })

  describe('generateProductId', () => {
    it('should generate product ID with count and timestamp', () => {
      const id = generateProductId(0)
      expect(id).toMatch(/^P001-\d+$/)
    })

    it('should generate unique IDs', async () => {
      const id1 = generateProductId(0)
      await new Promise(resolve => setTimeout(resolve, 2))
      const id2 = generateProductId(0)
      expect(id1).not.toBe(id2)
    })
  })

  describe('generateCashCloseId', () => {
    it('should generate formatted cash close ID', () => {
      expect(generateCashCloseId(0)).toBe('CC001')
      expect(generateCashCloseId(9)).toBe('CC010')
      expect(generateCashCloseId(99)).toBe('CC100')
    })
  })

  describe('generateAuditId', () => {
    it('should generate formatted audit ID', () => {
      expect(generateAuditId(0)).toBe('A001')
      expect(generateAuditId(9)).toBe('A010')
      expect(generateAuditId(99)).toBe('A100')
    })
  })

  describe('generateCategoryId', () => {
    it('should generate formatted category ID', () => {
      expect(generateCategoryId(0)).toBe('C001')
      expect(generateCategoryId(9)).toBe('C010')
      expect(generateCategoryId(99)).toBe('C100')
    })
  })

  describe('generateCartItemId', () => {
    it('should generate cart item ID with timestamp and random suffix', () => {
      const id = generateCartItemId()
      expect(id).toMatch(/^CI-\d+-[a-z0-9]{4}$/)
    })

    it('should generate unique IDs', () => {
      const id1 = generateCartItemId()
      const id2 = generateCartItemId()
      expect(id1).not.toBe(id2)
    })
  })
})
