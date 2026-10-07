import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCart } from '@/lib/hooks/useCart'
import type { POSProduct } from '@/lib/store'

describe('useCart', () => {
  const mockProduct: POSProduct = {
    id: 'P001',
    name: 'Test Product',
    categoryId: 'Test', trackStock: false,
    price: 10,
  }

  const mockProduct2: POSProduct = {
    id: 'P002',
    name: 'Test Product 2',
    categoryId: 'Test', trackStock: false,
    price: 20,
  }

  it('should initialize with empty cart', () => {
    const { result } = renderHook(() => useCart())
    expect(result.current.cart).toEqual([])
    expect(result.current.itemCount).toBe(0)
    expect(result.current.total).toBe(0)
  })

  it('should add product to cart', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addToCart(mockProduct, 2)
    })

    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].product).toEqual(mockProduct)
    expect(result.current.cart[0].quantity).toBe(2)
    expect(result.current.itemCount).toBe(1)
  })

  it('should increase quantity when adding existing product', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addToCart(mockProduct, 1)
      result.current.addToCart(mockProduct, 2)
    })

    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].quantity).toBe(3)
  })

  it('should remove product from cart', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addToCart(mockProduct)
    })

    const itemId = result.current.cart[0].id

    act(() => {
      result.current.removeFromCart(itemId)
    })

    expect(result.current.cart).toHaveLength(0)
  })

  it('should update product quantity', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addToCart(mockProduct, 1)
    })

    const itemId = result.current.cart[0].id

    act(() => {
      result.current.updateQuantity(itemId, 5)
    })

    expect(result.current.cart[0].quantity).toBe(5)
  })

  it('should update item discount', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addToCart(mockProduct)
    })

    const itemId = result.current.cart[0].id

    act(() => {
      result.current.updateItemDiscount(itemId, 10)
    })

    expect(result.current.cart[0].discount).toBe(10)
  })

  it('should calculate subtotal correctly', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addToCart(mockProduct, 2) // 10 * 2 = 20
      result.current.addToCart(mockProduct2, 1) // 20 * 1 = 20
    })

    expect(result.current.subtotal).toBe(40)
  })

  it('should calculate total with discounts', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addToCart(mockProduct, 2) // 10 * 2 = 20
    })

    const itemId = result.current.cart[0].id

    act(() => {
      result.current.updateItemDiscount(itemId, 10) // 10% discount = 2
    })

    expect(result.current.subtotal).toBe(20)
    expect(result.current.totalDiscount).toBe(2)
    expect(result.current.total).toBe(18)
  })

  it('should clear cart', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addToCart(mockProduct)
      result.current.addToCart(mockProduct2)
    })

    expect(result.current.cart).toHaveLength(2)

    act(() => {
      result.current.clearCart()
    })

    expect(result.current.cart).toHaveLength(0)
    expect(result.current.total).toBe(0)
  })

  it('should calculate item total correctly', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addToCart(mockProduct, 2)
    })

    const item = result.current.cart[0]
    const itemTotal = result.current.getItemTotal(item)

    expect(itemTotal).toBe(20) // 10 * 2
  })

  it('should calculate item total with discount', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addToCart(mockProduct, 2)
    })

    const itemId = result.current.cart[0].id

    act(() => {
      result.current.updateItemDiscount(itemId, 10)
    })

    const item = result.current.cart[0]
    const itemTotal = result.current.getItemTotal(item)

    expect(itemTotal).toBe(18) // (10 * 2) - 10% = 18
  })
})
