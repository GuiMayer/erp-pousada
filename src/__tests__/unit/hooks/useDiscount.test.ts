import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDiscount } from '@/lib/hooks/useDiscount'

describe('useDiscount', async () => {
  const DISCOUNT_CEILING = 5

  it('should initialize with default values', async () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))

    expect(result.current.discountValue).toBe(0)
    expect(result.current.needsApproval).toBe(false)
    expect(result.current.isApproved).toBe(false)
    expect(result.current.isValid).toBe(true)
  })

  it('should allow discount within ceiling', async () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))

    await act(async () => {
      result.current.setDiscountValue(3)
    })

    expect(result.current.discountValue).toBe(3)
    expect(result.current.needsApproval).toBe(false)
    expect(result.current.isValid).toBe(true)
  })

  it('should require approval for discount above ceiling', async () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))

    await act(async () => {
      result.current.setDiscountValue(10)
    })

    expect(result.current.needsApproval).toBe(true)
    expect(result.current.isValid).toBe(false)
  })

  it('should approve discount with correct supervisor password', async () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))

    await act(async () => {
      result.current.setDiscountValue(10)
    })

    let approved = false
    await act(async () => {
      approved = await result.current.handleSupervisorApproval('adm123')
    })

    expect(approved).toBe(true)
    expect(result.current.isApproved).toBe(true)
    expect(result.current.isValid).toBe(true)
  })

  it('should reject discount with incorrect supervisor password', async () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))

    await act(async () => {
      result.current.setDiscountValue(10)
    })

    let approved = false
    await act(async () => {
      approved = await result.current.handleSupervisorApproval('wrong')
    })

    expect(approved).toBe(false)
    expect(result.current.isApproved).toBe(false)
    expect(result.current.isValid).toBe(false)
  })

  it('should reset approval when discount changes back to valid range', async () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))

    await act(async () => {
      result.current.setDiscountValue(10)
      await result.current.handleSupervisorApproval('adm123')
    })

    expect(result.current.isApproved).toBe(true)

    await act(async () => {
      result.current.setDiscountValue(3)
    })

    expect(result.current.isApproved).toBe(false)
    expect(result.current.needsApproval).toBe(false)
  })

  it('should reset all state', async () => {
    const { result } = renderHook(() => useDiscount(DISCOUNT_CEILING))

    await act(async () => {
      result.current.setDiscountValue(10)
      await result.current.handleSupervisorApproval('adm123')
    })

    await act(async () => {
      result.current.reset()
    })

    expect(result.current.discountValue).toBe(0)
    expect(result.current.isApproved).toBe(false)
    expect(result.current.supervisorPassword).toBe('')
  })
})
