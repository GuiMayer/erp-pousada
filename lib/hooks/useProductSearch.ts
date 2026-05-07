import { useState, useMemo } from "react"
import type { POSProduct } from "../store"

/**
 * Hook for searching and filtering products
 */
export function useProductSearch(products: POSProduct[]) {
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("Todos")

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category))
    return ["Todos", ...Array.from(cats)]
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.includes(searchQuery)
      const matchesCategory = 
        categoryFilter === "Todos" || p.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [products, searchQuery, categoryFilter])

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
