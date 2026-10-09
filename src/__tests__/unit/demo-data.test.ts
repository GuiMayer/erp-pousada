import { describe, expect, it, vi } from "vitest"
import { createDemoData, seedDemoIfEmpty } from "../../../lib/demo-data"
import { createDataStore } from "../../../lib/data/repositories"
import { LocalStorageAdapter } from "../../../lib/data/storage-adapter"

describe("demonstration data", () => {
  it("keeps reservations and beverage sale totals consistent", () => {
    const data = createDemoData(new Date("2026-10-07T15:00:00Z"))
    for (const reservation of data.reservations) {
      expect(data.rooms.some((room) => room.id === reservation.roomId && room.number === reservation.roomNumber)).toBe(true)
      expect(data.guests.some((guest) => guest.cpf === reservation.cpf)).toBe(true)
      expect(reservation.checkOut > reservation.checkIn).toBe(true)
    }
    expect(data.restaurantTables).toEqual([])
    expect(data.restaurantOrders).toEqual([])
    expect(data.productCategories.every(category => !category.isRestaurant)).toBe(true)
    for (const sale of data.posSales) {
      expect(sale.total).toBe(sale.items.reduce((sum, item) => sum + item.quantity * item.product.price, 0))
      expect(data.transactions.some((transaction) => transaction.refId === sale.id && transaction.value === sale.total)).toBe(true)
    }
    expect(data.posSales.filter((sale) => sale.date.startsWith("2026-10-07"))).toHaveLength(8)
  })

  it("persists every example through the real browser storage adapter", async () => {
    const prefix = "demo-test"
    const adapter = new LocalStorageAdapter(prefix)
    const store = createDataStore({ adapter, enableSync: false })
    try {
      expect(await seedDemoIfEmpty(store)).toBe(true)
      expect(await store.rooms.getAll()).toHaveLength(12)
      expect(await store.reservations.getAll()).toHaveLength(10)
      expect(await store.posSales.getAll()).toHaveLength(112)
      expect(await store.stockItems.getAll()).toHaveLength(12)
      expect(await store.restaurantOrders.getAll()).toHaveLength(0)
      expect(await seedDemoIfEmpty(store)).toBe(false)
    } finally {
      await adapter.clear()
    }
  })

  it("preserves an existing store even when there are no rooms", async () => {
    const store = {
      exportAll: vi.fn().mockResolvedValue(JSON.stringify({ transactions: [{ id: "existing", value: 900 }] })),
      importAll: vi.fn(),
    }
    expect(await seedDemoIfEmpty(store)).toBe(false)
    expect(store.importAll).not.toHaveBeenCalled()
  })
})
