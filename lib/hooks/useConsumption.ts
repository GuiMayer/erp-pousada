import { useCallback, useMemo } from "react"
import type { ConsumptionItem } from "../store"
import { generateConsumptionItemId } from "../utils/id-generators"

type UseConsumptionProps = {
  roomId: number
  items: ConsumptionItem[]
  addItem: (roomId: number, item: ConsumptionItem) => void
  removeItem: (roomId: number, itemId: string) => void
}

/**
 * Hook for managing room consumption items
 */
export function useConsumption({ roomId, items, addItem, removeItem }: UseConsumptionProps) {
  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  }, [items])

  const addCustomItem = useCallback((label: string, unitPrice: number, quantity: number = 1) => {
    addItem(roomId, {
      id: generateConsumptionItemId(),
      label,
      unitPrice,
      quantity,
    })
  }, [roomId, addItem])

  const addCatalogItem = useCallback((label: string, unitPrice: number) => {
    addItem(roomId, {
      id: generateConsumptionItemId(),
      label,
      unitPrice,
      quantity: 1,
    })
  }, [roomId, addItem])

  const removeConsumptionItem = useCallback((itemId: string) => {
    removeItem(roomId, itemId)
  }, [roomId, removeItem])

  return {
    items,
    total,
    addCustomItem,
    addCatalogItem,
    removeConsumptionItem,
    itemCount: items.length,
  }
}
