import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePayment } from '@/lib/hooks/usePayment'

describe('usePayment', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePayment(100))
    
    expect(result.current.paymentMethod).toBe('dinheiro')
    expect(result.current.amountPaid).toBe('')
    expect(result.current.amountPaidNumber).toBe(0)
    expect(result.current.change).toBe(0)
    expect(result.current.isValidPayment).toBe(false)
  })

  it('should update payment method', () => {
    const { result } = renderHook(() => usePayment(100))
    
    act(() => {
      result.current.setPaymentMethod('cartao_credito')
    })

    expect(result.current.paymentMethod).toBe('cartao_credito')
  })

  it('should update amount paid', () => {
    const { result } = renderHook(() => usePayment(100))
    
    act(() => {
      result.current.setAmountPaid('150')
    })

    expect(result.current.amountPaid).toBe('150')
    expect(result.current.amountPaidNumber).toBe(150)
  })

  it('should calculate change correctly', () => {
    const { result } = renderHook(() => usePayment(100))
    
    act(() => {
      result.current.setAmountPaid('150')
    })

    expect(result.current.change).toBe(50)
  })

  it('should validate sufficient payment', () => {
    const { result } = renderHook(() => usePayment(100))
    
    act(() => {
      result.current.setAmountPaid('100')
    })

    expect(result.current.isValidPayment).toBe(true)
  })

  it('should invalidate insufficient payment', () => {
    const { result } = renderHook(() => usePayment(100))
    
    act(() => {
      result.current.setAmountPaid('50')
    })

    expect(result.current.isValidPayment).toBe(false)
  })

  it('should set amount to total', () => {
    const { result } = renderHook(() => usePayment(123.45))
    
    act(() => {
      result.current.setAmountToTotal()
    })

    expect(result.current.amountPaid).toBe('123.45')
    expect(result.current.isValidPayment).toBe(true)
  })

  it('should reset payment state', () => {
    const { result } = renderHook(() => usePayment(100))
    
    act(() => {
      result.current.setPaymentMethod('pix')
      result.current.setAmountPaid('150')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.paymentMethod).toBe('dinheiro')
    expect(result.current.amountPaid).toBe('')
    expect(result.current.amountPaidNumber).toBe(0)
  })

  it('should handle invalid amount input', () => {
    const { result } = renderHook(() => usePayment(100))
    
    act(() => {
      result.current.setAmountPaid('invalid')
    })

    expect(result.current.amountPaidNumber).toBe(0)
    expect(result.current.isValidPayment).toBe(false)
  })

  it('should not allow negative change', () => {
    const { result } = renderHook(() => usePayment(100))
    
    act(() => {
      result.current.setAmountPaid('50')
    })

    expect(result.current.change).toBe(0)
  })
})
