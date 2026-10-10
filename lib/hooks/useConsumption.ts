import { useCallback, useMemo } from "react"
import type { ConsumptionItem } from "../store"
import { generateConsumptionItemId } from "../utils/id-generators"

type UseConsumptionProps = {
  roomId: number
  items: ConsumptionItem[]
  addItem: (roomId: number, item: ConsumptionItem) => void | Promise<void>
  removeItem: (roomId: number, itemId: string) => void | Promise<void>
}

/**
 * Hook for managing room consumption items
 */
export function useConsumption({ roomId, items, addItem, removeItem }: UseConsumptionProps) {
  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  }, [items])

  const addCustomItem = useCallback(async (label: string, unitPrice: number, quantity: number = 1) => {
    await addItem(roomId, {
      id: generateConsumptionItemId(),
      label,
      unitPrice,
      quantity,
    })
  }, [roomId, addItem])

  const addCatalogItem = useCallback(async (label: string, unitPrice: number, productId?: string) => {
    await addItem(roomId, {
      id: generateConsumptionItemId(),
      label,
      unitPrice,
      quantity: 1,
      ...(productId ? { productId } : {}),
    })
  }, [roomId, addItem])

  const removeConsumptionItem = useCallback(async (itemId: string) => {
    await removeItem(roomId, itemId)
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
