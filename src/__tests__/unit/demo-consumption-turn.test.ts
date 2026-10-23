import { beforeEach, afterEach, describe, it, expect } from "vitest"
import { createDataStore } from "@/lib/data/repositories"
import { LocalStorageAdapter } from "@/lib/data/storage-adapter"
import { createDemoData } from "@/lib/demo-data"
import { demoAddConsumption, demoPayConsumption } from "@/lib/data/demo-consumption"
import { stayBalance } from "@/lib/stays"
const adapter = new LocalStorageAdapter("consumption-turn-tests")
let store: ReturnType<typeof createDataStore>
const stayId = "demo-stay-R003", can = () => true
const item = { id: "test-water", productId: "P001", label: "Preço adulterado", unitPrice: 1, quantity: 2 }
beforeEach(async () => { store = createDataStore({ adapter, enableSync: false }); await store.importAll(JSON.stringify(createDemoData())) })
afterEach(async () => { await adapter.clear() })
describe("Consumo e turno", () => {
  it("recusa entrega fechada e hóspede trocado sem efeitos", async () => {
    await store.cashCloses.update("DEMO-OPEN-CASH", { status: "fechado" })
    const before = JSON.parse(await store.exportAll())
    await expect(demoAddConsumption(store, 6, item, stayId, can, "Ana")).rejects.toThrow("Caixa fechado")
    await expect(demoAddConsumption(store, 6, item, "old-stay", can, "Ana")).rejects.toThrow("hospedagem")
    expect(JSON.parse(await store.exportAll())).toEqual(before)
  })
  it("entrega uma vez no A, recebe por PIX fora do turno sem outra baixa e conserva o extrato", async () => {
    const stock = (await store.stockItems.getAll()).find(s => s.productId === item.productId)!.currentStock
    await demoAddConsumption(store, 6, item, stayId, can, "Ana")
    await demoAddConsumption(store, 6, item, stayId, can, "Ana")
    const stay = (await store.stays.getById(stayId))!
    expect(stayBalance(stay).consumptionBalance).toBe(10)
    expect(stay.charges.find(c => c.id === item.id)!.operationalSessionId).toBe("DEMO-OPEN-CASH")
    await store.cashCloses.update("DEMO-OPEN-CASH", { status: "fechado" })
    const payload = { roomId: 6, expectedStayId: stayId, recordVersion: stay.recordVersion, paymentMethod: "pix", accountId: "DEMO-BANK" }
    const before = await store.transactions.count()
    await demoPayConsumption(store, payload, can, "Ana", "payment-1")
    await demoPayConsumption(store, payload, can, "Ana", "payment-1")
    expect(await store.transactions.count()).toBe(before + 1)
    expect((await store.transactions.getAll()).find(t => t.originType === "stay-consumption")!.operationalSessionId).toBeUndefined()
    expect(stayBalance((await store.stays.getById(stayId))!).consumptionBalance).toBe(0)
    expect((await store.stockItems.getAll()).find(s => s.productId === item.productId)!.currentStock).toBe(stock - 2)
    expect((await store.stays.getById(stayId))!.charges.filter(c => c.id === item.id)).toHaveLength(1)
  })
})
