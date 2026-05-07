import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDiscount } from '@/lib/hooks/useDiscount'

describe('useDiscount', () => {
  const DISCOUNT_CEILING = 5

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))
    
    expect(result.current.discountValue).toBe(0)
    expect(result.current.needsApproval).toBe(false)
    expect(result.current.isApproved).toBe(false)
    expect(result.current.isValid).toBe(true)
  })

  it('should allow discount within ceiling', () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))
    
    act(() => {
      result.current.setDiscountValue(3)
    })

    expect(result.current.discountValue).toBe(3)
    expect(result.current.needsApproval).toBe(false)
    expect(result.current.isValid).toBe(true)
  })

  it('should require approval for discount above ceiling', () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))
    
    act(() => {
      result.current.setDiscountValue(10)
    })

    expect(result.current.needsApproval).toBe(true)
    expect(result.current.isValid).toBe(false)
  })

  it('should approve discount with correct supervisor password', () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))
    
    act(() => {
      result.current.setDiscountValue(10)
    })

    let approved = false
    act(() => {
      approved = result.current.handleSupervisorApproval('admin')
    })

    expect(approved).toBe(true)
    expect(result.current.isApproved).toBe(true)
    expect(result.current.isValid).toBe(true)
  })

  it('should reject discount with incorrect supervisor password', () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))
    
    act(() => {
      result.current.setDiscountValue(10)
    })

    let approved = false
    act(() => {
      approved = result.current.handleSupervisorApproval('wrong')
    })

    expect(approved).toBe(false)
    expect(result.current.isApproved).toBe(false)
    expect(result.current.isValid).toBe(false)
  })

  it('should reset approval when discount changes back to valid range', () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))
    
    act(() => {
      result.current.setDiscountValue(10)
      result.current.handleSupervisorApproval('admin')
    })

    expect(result.current.isApproved).toBe(true)

    act(() => {
      result.current.setDiscountValue(3)
    })

    expect(result.current.isApproved).toBe(false)
    expect(result.current.needsApproval).toBe(false)
  })

  it('should reset all state', () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))
    
    act(() => {
      result.current.setDiscountValue(10)
      result.current.handleSupervisorApproval('admin')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.discountValue).toBe(0)
    expect(result.current.isApproved).toBe(false)
    expect(result.current.supervisorPassword).toBe('')
  })
})
