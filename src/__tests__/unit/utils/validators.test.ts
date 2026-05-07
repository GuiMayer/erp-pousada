import { describe, it, expect } from 'vitest'
import {
  validateSupervisorPassword,
  validateCPF,
  validateDiscount,
  requiresSupervisorApproval,
  validatePaymentAmount,
  validateISODate,
  validateCheckInOutDates,
} from '@/lib/utils/validators'

describe('Validators', () => {
  describe('validateSupervisorPassword', () => {
    it('should validate correct supervisor password', () => {
      expect(validateSupervisorPassword('admin')).toBe(true)
    })

    it('should reject incorrect password', () => {
      expect(validateSupervisorPassword('wrong')).toBe(false)
      expect(validateSupervisorPassword('')).toBe(false)
      expect(validateSupervisorPassword('Admin')).toBe(false)
    })
  })

  describe('validateCPF', () => {
    it('should validate CPF with correct format', () => {
      expect(validateCPF('123.456.789-00')).toBe(true)
      expect(validateCPF('12345678900')).toBe(true)
    })

    it('should reject CPF with invalid format', () => {
      expect(validateCPF('123')).toBe(false)
      expect(validateCPF('123.456.789')).toBe(false)
      expect(validateCPF('')).toBe(false)
    })

    it('should reject CPF with all same digits', () => {
      expect(validateCPF('111.111.111-11')).toBe(false)
      expect(validateCPF('00000000000')).toBe(false)
    })
  })

  describe('validateDiscount', () => {
    it('should validate discount within ceiling', () => {
      expect(validateDiscount(5, 10)).toBe(true)
      expect(validateDiscount(0, 10)).toBe(true)
      expect(validateDiscount(10, 10)).toBe(true)
    })

    it('should reject discount above ceiling', () => {
      expect(validateDiscount(15, 10)).toBe(false)
    })

    it('should reject negative discount', () => {
      expect(validateDiscount(-5, 10)).toBe(false)
    })
  })

  describe('requiresSupervisorApproval', () => {
    it('should require approval for discount above ceiling', () => {
      expect(requiresSupervisorApproval(15, 10)).toBe(true)
    })

    it('should not require approval for discount within ceiling', () => {
      expect(requiresSupervisorApproval(5, 10)).toBe(false)
      expect(requiresSupervisorApproval(10, 10)).toBe(false)
    })
  })

  describe('validatePaymentAmount', () => {
    it('should validate sufficient payment', () => {
      expect(validatePaymentAmount(100, 100)).toBe(true)
      expect(validatePaymentAmount(150, 100)).toBe(true)
    })

    it('should reject insufficient payment', () => {
      expect(validatePaymentAmount(50, 100)).toBe(false)
    })
  })

  describe('validateISODate', () => {
    it('should validate correct ISO date strings', () => {
      expect(validateISODate('2026-05-07')).toBe(true)
      expect(validateISODate('2026-05-07T10:30:00')).toBe(true)
    })

    it('should reject invalid date strings', () => {
      expect(validateISODate('invalid')).toBe(false)
      expect(validateISODate('2026-13-01')).toBe(false)
      expect(validateISODate('')).toBe(false)
    })
  })

  describe('validateCheckInOutDates', () => {
    it('should validate checkout after checkin', () => {
      expect(validateCheckInOutDates('2026-05-07', '2026-05-10')).toBe(true)
    })

    it('should reject checkout before or same as checkin', () => {
      expect(validateCheckInOutDates('2026-05-10', '2026-05-07')).toBe(false)
      expect(validateCheckInOutDates('2026-05-07', '2026-05-07')).toBe(false)
    })
  })
})
