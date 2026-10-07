import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProductSearch } from '@/lib/hooks/useProductSearch'
import type { POSProduct } from '@/lib/store'

describe('useProductSearch', () => {
  const mockProducts: POSProduct[] = [
    {
      id: 'P001',
      name: 'Água Mineral',
      categoryId: 'C001',
      price: 5,
      barcode: '7891234567890',
      trackStock: true,
    },
    {
      id: 'P002',
      name: 'Refrigerante',
      categoryId: 'C001',
      price: 8,
      trackStock: true,
    },
    {
      id: 'P003',
      name: 'Sabonete',
      categoryId: 'C002',
      price: 3,
      barcode: '7891234567891',
      trackStock: true,
    },
  ]

  const mockGetCategoryName = (categoryId: string) => {
    const categories: Record<string, string> = {
      'C001': 'Bebidas',
      'C002': 'Higiene',
    }
    return categories[categoryId] || 'Desconhecido'
  }

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts, mockGetCategoryName))

    expect(result.current.searchQuery).toBe('')
    expect(result.current.categoryFilter).toBe('Todos')
    expect(result.current.filteredProducts).toEqual(mockProducts)
  })

  it('should extract unique categories', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts, mockGetCategoryName))

    expect(result.current.categories).toEqual(['Todos', 'Bebidas', 'Higiene'])
  })

  it('should filter products by search query', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts, mockGetCategoryName))

    act(() => {
      result.current.setSearchQuery('água')
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe('Água Mineral')
  })

  it('should filter products by category', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts, mockGetCategoryName))

    act(() => {
      result.current.setCategoryFilter('Bebidas')
    })

    expect(result.current.filteredProducts).toHaveLength(2)
  })

  it('should filter by both search and category', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts, mockGetCategoryName))

    act(() => {
      result.current.setSearchQuery('refri')
      result.current.setCategoryFilter('Bebidas')
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe('Refrigerante')
  })

  it('should search by barcode', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts, mockGetCategoryName))

    act(() => {
      result.current.setSearchQuery('7891234567890')
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe('Água Mineral')
  })

  it('should find product by barcode', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts, mockGetCategoryName))

    const product = result.current.findByBarcode('7891234567890')

    expect(product).toBeDefined()
    expect(product?.name).toBe('Água Mineral')
  })

  it('should return undefined for non-existent barcode', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts, mockGetCategoryName))

    const product = result.current.findByBarcode('9999999999999')

    expect(product).toBeUndefined()
  })

  it('should be case-insensitive in search', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts, mockGetCategoryName))

    act(() => {
      result.current.setSearchQuery('ÁGUA')
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe('Água Mineral')
  })

  it('should show all products when category is "Todos"', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts, mockGetCategoryName))

    act(() => {
      result.current.setCategoryFilter('Bebidas')
      result.current.setCategoryFilter('Todos')
    })

    expect(result.current.filteredProducts).toEqual(mockProducts)
  })
})
