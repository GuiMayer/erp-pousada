import { afterEach, describe, expect, it, vi } from "vitest"
import { createDemoData, seedDemoSession, initializeBrowserDemo } from "../../../lib/demo-data"
import { createDataStore } from "../../../lib/data/repositories"
import { LocalStorageAdapter } from "../../../lib/data/storage-adapter"
import { isCPF } from "@/lib/utils/cpf-cnpj-validator"

describe("demonstration data", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
  it("keeps reservations and beverage sale totals consistent", () => {
    const data = createDemoData(new Date("2026-10-07T15:00:00Z"))
    for (const reservation of data.reservations) {
      expect(data.rooms.some((room) => room.id === reservation.roomId && room.number === reservation.roomNumber)).toBe(true)
      expect(data.guests.some((guest) => guest.cpf === reservation.cpf)).toBe(true)
      expect(reservation.checkOut > reservation.checkIn).toBe(true)
      expect(isCPF(reservation.cpf)).toBe(true)
      expect(reservation.guestCount).toBeGreaterThan(0)
      expect(data.customers.some(c => c.id === reservation.payerId)).toBe(true)
      expect(reservation.nightlyPrices?.reduce((sum, n) => sum + n.total, 0)).toBe(reservation.totalValue)
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
      vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "demo-localStorage")
      expect(await seedDemoSession(store, "2026-10-22T15:00:00Z")).toBe(true)
      expect(await store.rooms.getAll()).toHaveLength(12)
      expect(await store.reservations.getAll()).toHaveLength(17)
      expect(await store.posSales.getAll()).toHaveLength(112)
      expect(await store.stockItems.getAll()).toHaveLength(12)
      expect(await store.restaurantOrders.getAll()).toHaveLength(0)
      expect(await seedDemoSession(store, "2026-10-22T15:00:00Z")).toBe(false)
    } finally {
      await adapter.clear()
    }
  })

  it("preserves edits in a session and restores all examples only after a new server start", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "demo-localStorage")
    let snapshot = JSON.stringify({ transactions: [{ id: "old-example", value: 900 }], stays: [{ id: "old-stay" }] })
    const store = {
      exportAll: vi.fn(async () => snapshot),
      importAll: vi.fn(async (json: string) => { snapshot = json }),
    }
    await seedDemoSession(store, "2026-10-22T15:00:00Z")
    const edited = JSON.parse(snapshot); edited.reservations[0].guestName = "Teste do operador"
    snapshot = JSON.stringify(edited)
    expect(await seedDemoSession(store, "2026-10-22T15:00:00Z")).toBe(false)
    expect(JSON.parse(snapshot).reservations[0].guestName).toBe("Teste do operador")
    expect(await seedDemoSession(store, "2026-10-23T15:00:00Z")).toBe(true)
    const reset = JSON.parse(snapshot)
    expect(reset.reservations.find((r: { id: string }) => r.id === "DEMO-R009").checkIn).toBe("2026-10-24")
    expect(reset.stays.some((s: { id: string }) => s.id === "old-stay")).toBe(false)
  })

  it("never writes operational data or resets examples on a failed session request", async () => {
    const store = { exportAll: vi.fn(), importAll: vi.fn() }
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    await expect(seedDemoSession(store, "2026-10-22T15:00:00Z")).rejects.toThrow("apenas na demonstração")
    await expect(initializeBrowserDemo(store)).rejects.toThrow("apenas na demonstração")
    expect(store.exportAll).not.toHaveBeenCalled()
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "demo-localStorage")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    await expect(initializeBrowserDemo(store)).rejects.toThrow("Recarregue")
    await expect(seedDemoSession(store, "invalid")).rejects.toThrow("inválida")
    expect(store.importAll).not.toHaveBeenCalled()
  })

  it.each(["2026-01-31T15:00:00Z", "2026-12-31T15:00:00Z", "2026-11-01T01:00:00Z"])("builds a coherent room calendar around server start %s", (anchor) => {
    const data = createDemoData(new Date(anchor))
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(anchor))
    const tomorrow = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10)
    expect(data.reservations.some(r => r.status === "confirmada" && r.checkIn === day)).toBe(true)
    expect(data.reservations.filter(r => r.status === "confirmada" && r.checkIn === tomorrow)).toHaveLength(3)
    expect(data.stays.filter(s => s.status === "active")).toHaveLength(5)
    expect(data.stays.some(s => s.status === "closed")).toBe(true)
    for (const room of data.rooms) {
      const bookings = data.reservations.filter(r => r.roomId === room.id && ["confirmada", "checkin"].includes(r.status))
      for (const [index, r] of bookings.entries()) {
        expect(bookings.slice(index + 1).some(other => r.checkIn < other.checkOut && other.checkIn < r.checkOut)).toBe(false)
      }
      if (room.status === "ocupado") expect(data.stays.some(s => s.roomId === room.id && s.status === "active" && s.guestName === room.guest)).toBe(true)
    }
  })
})
