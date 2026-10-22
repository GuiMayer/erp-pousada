import { beforeEach, afterEach, describe, it, expect, vi } from "vitest"
import { createDemoData } from "@/lib/demo-data"
import { stayBalance } from "@/lib/stays"
import { reservationAmounts } from "@/lib/reservation-amounts"
import { createDataStore } from "@/lib/data/repositories"
import { LocalStorageAdapter } from "@/lib/data/storage-adapter"
import { demoStayOperation } from "@/lib/data/demo-stays"

const data = () => createDemoData(new Date("2026-10-22T15:00:00Z"))
describe("Origens e saldos dos cenários de demonstração", () => {
  it("separa total, recebido e saldo em centavos, inclusive para grupos", () => {
    expect(reservationAmounts([{ totalValue: 600, paidValue: 100 }])).toEqual({ total: 600, received: 100, balance: 500 })
    expect(reservationAmounts([{ totalValue: 0.1, paidValue: 0 }, { totalValue: 0.2, paidValue: 0.1 }])).toEqual({ total: 0.3, received: 0.1, balance: 0.2 })
  })
  it("cada cobrança pertence a uma hospedagem empresarial encerrada e corresponde ao saldo", () => {
    const snapshot = data()
    expect(snapshot.accountsReceivable.length).toBeGreaterThan(0)
    for (const title of snapshot.accountsReceivable) {
      const stay = snapshot.stays.find(s => s.id === title.sourceStayId)!
      expect(stay.status).toBe("closed")
      expect(title.customerId).toBe(stay.payerId)
      expect(title.value - title.paidValue).toBe(stayBalance(stay).balance)
      expect(title.description).toContain(stay.reservationId)
    }
    expect(snapshot.stays.some(s => s.status === "active" && s.charges.length > 0 && stayBalance(s).consumptionBalance === 0)).toBe(true)
    expect(snapshot.posProducts.every(p => snapshot.productCategories.some(c => c.id === p.categoryId && !c.isRestaurant))).toBe(true)
    expect(snapshot.auditLog.every(e => e.operation && e.entityType && e.entityId)).toBe(true)
  })
})
const adapter = new LocalStorageAdapter("review-finance")
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "demo-localStorage"))
afterEach(async () => { await adapter.clear(); vi.unstubAllEnvs() })
it("receber dívida empresarial atualiza título e hospedagem juntos, sem segunda baixa de estoque", async () => {
  const store = createDataStore({ adapter, enableSync: false })
  const snapshot = data(); await store.importAll(JSON.stringify(snapshot))
  const title = snapshot.accountsReceivable[0], stay = snapshot.stays.find(s => s.id === title.sourceStayId)!
  const before = stayBalance(stay).balance, stock = await store.stockItems.getAll(), count = await store.transactions.count()
  const input = { stayId: stay.id, recordVersion: stay.recordVersion, value: 50, paymentMethod: "pix", accountId: "DEMO-BANK" }
  await demoStayOperation(store, "receive-account", input, () => true, "supervisor")
  const current = (await store.stays.getById(stay.id))!, bill = (await store.accountsReceivable.getById(title.id))!
  expect(stayBalance(current).balance).toBe(before - 50)
  expect(bill.value - (bill.paidValue ?? 0)).toBe(before - 50)
  await expect(demoStayOperation(store, "receive-account", input, () => true, "supervisor")).rejects.toThrow("alterada")
  expect(await store.transactions.count()).toBe(count + 1)
  expect(await store.stockItems.getAll()).toEqual(stock)
})
