import { useState, useMemo } from "react"
import type { POSProduct } from "../store"

/**
 * Hook for searching and filtering products
 */
export function useProductSearch(
  products: POSProduct[], 
  getCategoryName: (categoryId: string) => string
) {
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("Todos")

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => getCategoryName(p.categoryId)))
    return ["Todos", ...Array.from(cats)]
  }, [products, getCategoryName])

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.includes(searchQuery)
      const matchesCategory = 
        categoryFilter === "Todos" || getCategoryName(p.categoryId) === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [products, searchQuery, categoryFilter, getCategoryName])

  const findByBarcode = (barcode: string): POSProduct | undefined => {
    return products.find(p => p.barcode === barcode)
  }

  return {
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    categories,
    filteredProducts,
    findByBarcode,
  }
}
