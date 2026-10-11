import { useCallback, useMemo } from "react"
import type { ConsumptionItem } from "../store"
import { generateConsumptionItemId } from "../utils/id-generators"
import { useTaskRef } from "@/contexts/task-drafts-context"

type UseConsumptionProps = {
  roomId: number
  stayId?: string
  items: ConsumptionItem[]
  addItem: (roomId: number, item: ConsumptionItem) => void | Promise<void>
  removeItem: (roomId: number, itemId: string) => void | Promise<void>
}

/**
 * Hook for managing room consumption items
 */
export function useConsumption({ roomId, stayId, items, addItem, removeItem }: UseConsumptionProps) {
  const requests = useTaskRef<Map<string, ConsumptionItem>>(`consumption.${roomId}.${stayId ?? 'legacy'}.requests`, new Map())
  const send = useCallback(async (data: Omit<ConsumptionItem, 'id'>) => {
    const key = JSON.stringify({ stayId, data })
    const item = requests.current.get(key) ?? { ...data, id: generateConsumptionItemId() }
    requests.current.set(key, item)
    await addItem(roomId, item)
    requests.current.delete(key)
  }, [addItem, roomId, requests, stayId])
  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  }, [items])

  const addCustomItem = useCallback(async (label: string, unitPrice: number, quantity: number = 1) => {
    await send({
      label,
      unitPrice,
      quantity,
    })
  }, [send])

  const addCatalogItem = useCallback(async (label: string, unitPrice: number, productId?: string, quantity = 1) => {
    await send({
      label,
      unitPrice,
      quantity,
      ...(productId ? { productId } : {}),
    })
  }, [send])

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
