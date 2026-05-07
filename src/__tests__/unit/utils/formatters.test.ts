import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatDateBR,
  formatDateTime,
  getDateLabel,
  getDateISO,
  daysUntilDue,
} from '@/lib/utils/formatters'

describe('Formatters', () => {
  describe('formatCurrency', () => {
    it('should format positive numbers as BRL currency', () => {
      expect(formatCurrency(1234.56)).toBe('R$ 1.234,56')
      expect(formatCurrency(100)).toBe('R$ 100,00')
      expect(formatCurrency(0.5)).toBe('R$ 0,50')
    })

    it('should format negative numbers as BRL currency', () => {
      expect(formatCurrency(-1234.56)).toBe('-R$ 1.234,56')
    })

    it('should format zero', () => {
      expect(formatCurrency(0)).toBe('R$ 0,00')
    })
  })

  describe('formatDateBR', () => {
    it('should format ISO date string to Brazilian short format', () => {
      expect(formatDateBR('2026-05-07')).toBe('07/05/26')
      expect(formatDateBR('2026-12-31')).toBe('31/12/26')
    })

    it('should handle ISO datetime strings', () => {
      expect(formatDateBR('2026-05-07T10:30:00')).toBe('07/05/26')
    })
  })

  describe('formatDateTime', () => {
    it('should format ISO datetime to Brazilian format', () => {
      const result = formatDateTime('2026-05-07T10:30:00')
      expect(result).toMatch(/07\/05\/2026/)
      expect(result).toMatch(/10:30/)
    })
  })

  describe('getDateLabel', () => {
    it('should return formatted date label for offset', () => {
      const label = getDateLabel(0)
      expect(label).toMatch(/^\d{1,2} (Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)$/)
    })
  })

  describe('getDateISO', () => {
    it('should return ISO date string for today', () => {
      const today = getDateISO(0)
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should return ISO date string for tomorrow', () => {
      const tomorrow = getDateISO(1)
      expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      
      const todayDate = new Date(getDateISO(0))
      const tomorrowDate = new Date(tomorrow)
      expect(tomorrowDate.getTime() - todayDate.getTime()).toBe(24 * 60 * 60 * 1000)
    })
  })

  describe('daysUntilDue', () => {
    it('should calculate days until due date', () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowISO = tomorrow.toISOString().split('T')[0]
      
      expect(daysUntilDue(tomorrowISO)).toBe(1)
    })

    it('should return negative for overdue dates', () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayISO = yesterday.toISOString().split('T')[0]
      
      expect(daysUntilDue(yesterdayISO)).toBe(-1)
    })

    it('should return 0 for today', () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString().split('T')[0]
      
      expect(daysUntilDue(todayISO)).toBe(0)
    })
  })
})
