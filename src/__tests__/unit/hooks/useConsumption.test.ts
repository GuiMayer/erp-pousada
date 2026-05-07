import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConsumption } from '@/lib/hooks/useConsumption'
import type { ConsumptionItem } from '@/lib/store'

describe('useConsumption', () => {
  const mockItems: ConsumptionItem[] = [
    {
      id: 'CI-1',
      label: 'Água Mineral',
      unitPrice: 5,
      quantity: 2,
    },
    {
      id: 'CI-2',
      label: 'Refrigerante',
      unitPrice: 8,
      quantity: 1,
    },
  ]

  const mockAddItem = vi.fn()
  const mockRemoveItem = vi.fn()

  beforeEach(() => {
    mockAddItem.mockClear()
    mockRemoveItem.mockClear()
  })

  it('should calculate total correctly', () => {
    const { result } = renderHook(() => useConsumption({
      roomId: 1,
      items: mockItems,
      addItem: mockAddItem,
      removeItem: mockRemoveItem,
    }))

    expect(result.current.total).toBe(18) // (5 * 2) + (8 * 1)
  })

  it('should return item count', () => {
    const { result } = renderHook(() => useConsumption({
      roomId: 1,
      items: mockItems,
      addItem: mockAddItem,
      removeItem: mockRemoveItem,
    }))

    expect(result.current.itemCount).toBe(2)
  })

  it('should add custom item', () => {
    const { result } = renderHook(() => useConsumption({
      roomId: 1,
      items: [],
      addItem: mockAddItem,
      removeItem: mockRemoveItem,
    }))

    act(() => {
      result.current.addCustomItem('Serviço de Quarto', 50, 1)
    })

    expect(mockAddItem).toHaveBeenCalledWith(1, expect.objectContaining({
      label: 'Serviço de Quarto',
      unitPrice: 50,
      quantity: 1,
    }))
  })

  it('should add catalog item with quantity 1', () => {
    const { result } = renderHook(() => useConsumption({
      roomId: 1,
      items: [],
      addItem: mockAddItem,
      removeItem: mockRemoveItem,
    }))

    act(() => {
      result.current.addCatalogItem('Água Mineral', 5)
    })

    expect(mockAddItem).toHaveBeenCalledWith(1, expect.objectContaining({
      label: 'Água Mineral',
      unitPrice: 5,
      quantity: 1,
    }))
  })

  it('should remove consumption item', () => {
    const { result } = renderHook(() => useConsumption({
      roomId: 1,
      items: mockItems,
      addItem: mockAddItem,
      removeItem: mockRemoveItem,
    }))

    act(() => {
      result.current.removeConsumptionItem('CI-1')
    })

    expect(mockRemoveItem).toHaveBeenCalledWith(1, 'CI-1')
  })

  it('should handle empty items', () => {
    const { result } = renderHook(() => useConsumption({
      roomId: 1,
      items: [],
      addItem: mockAddItem,
      removeItem: mockRemoveItem,
    }))

    expect(result.current.total).toBe(0)
    expect(result.current.itemCount).toBe(0)
  })

  it('should generate unique IDs for items', () => {
    const { result } = renderHook(() => useConsumption({
      roomId: 1,
      items: [],
      addItem: mockAddItem,
      removeItem: mockRemoveItem,
    }))

    act(() => {
      result.current.addCustomItem('Item 1', 10, 1)
      result.current.addCustomItem('Item 2', 20, 1)
    })

    const call1 = mockAddItem.mock.calls[0][1]
    const call2 = mockAddItem.mock.calls[1][1]

    expect(call1.id).not.toBe(call2.id)
  })
})
