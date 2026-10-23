import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createDataStore } from "@/lib/data/repositories"
import { LocalStorageAdapter } from "@/lib/data/storage-adapter"
import { createDemoData } from "@/lib/demo-data"
import { demoPOSOperation } from "@/lib/data/demo-pos"
import { reconcileDemoStays } from "@/lib/data/demo-stays"
import { stayBalance } from "@/lib/stays"

const adapter = new LocalStorageAdapter("pos-flow-tests")
let store: ReturnType<typeof createDataStore>
const can = (_permission: string) => true
const stayId = "demo-stay-R003"
const input = (extra = {}) => ({ globalDiscount: 0, sale: { id: "sale-test", items: [{ id: "item-test", product: { id: "P001" }, quantity: 2, discount: 0 }], total: 10, amountPaid: 0, stayId, stayVersion: 0, ...extra } })
const run = (payload: unknown, permissions = can) => demoPOSOperation(store, "sale", payload, permissions, "supervisor")
beforeEach(async () => { store = createDataStore({ adapter, enableSync: false }); vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "demo-localStorage"); await store.importAll(JSON.stringify(createDemoData(new Date("2026-10-22T15:00:00Z")))) })
afterEach(async () => { await adapter.clear(); vi.unstubAllEnvs() })

describe("Entrega no PDV com cobrança imediata ou na ficha", () => {
  it("lança na ficha e no mapa sem recebimento, baixa uma vez e evita duplicação no recarregamento", async () => {
    const stock = (await store.stockItems.getAll()).find(s => s.productId === "P001")!.currentStock
    const transactions = await store.transactions.count()
    await run(input())
    await run(input())
    await reconcileDemoStays(store)
    expect(stayBalance((await store.stays.getById(stayId))!).consumptionBalance).toBe(10)
    expect(await store.consumptions.getTotalByRoomId(6)).toBe(10)
    expect(await store.transactions.count()).toBe(transactions)
    expect((await store.stockItems.getAll()).find(s => s.productId === "P001")!.currentStock).toBe(stock - 2)
  })
  it("recebe no caixa e identifica o hóspede sem criar débito na ficha", async () => {
    const before = await store.transactions.count()
    await run(input({ stayId: undefined, stayVersion: undefined, customer: "Roberto Almeida", amountPaid: 20, payments: [{ method: "dinheiro", value: 20 }] }))
    expect(stayBalance((await store.stays.getById(stayId))!).consumptionBalance).toBe(0)
    expect(await store.consumptions.getTotalByRoomId(6)).toBe(0)
    expect(await store.transactions.count()).toBe(before + 1)
    expect((await store.transactions.getAll()).find(t => t.originId === "sale-test")?.cashSessionId).toBe("DEMO-OPEN-CASH")
    const sale = (await store.posSales.getById("sale-test"))!
    expect(sale.change).toBe(10)
    expect(sale.stayId).toBeUndefined()
    expect(sale.customer).toBe("Roberto Almeida")
  })
  it("não deixa estoque ou venda parcial quando o pagamento falha", async () => {
    const before = JSON.parse(await store.exportAll())
    await expect(run(input({ stayId: undefined, amountPaid: 10, payments: [{ method: "pix", value: 10, accountId: "invalid" }] }))).rejects.toThrow("conta ativa")
    expect(JSON.parse(await store.exportAll())).toEqual(before)
  })
  it("recusa versão desatualizada, falta de permissão e hospedagem encerrada", async () => {
    await expect(run(input({ stayVersion: 99 }))).rejects.toThrow("alterada")
    await expect(run(input(), p => p !== "consumptions.create")).rejects.toThrow("permissão")
    await store.stays.update(stayId, { status: "closed" })
    await expect(run(input())).rejects.toThrow("encerrada")
    expect(await store.posSales.getById("sale-test")).toBeNull()
  })
  it("corrige a ficha ao estornar sem gerar devolução de dinheiro inexistente", async () => {
    const before = await store.transactions.count()
    const stock = (await store.stockItems.getAll()).find(s => s.productId === "P001")!.currentStock
    await run(input())
    await demoPOSOperation(store, "cancel-sale", { saleId: "sale-test", reason: "Produto devolvido", returnToStock: true }, can, "supervisor")
    await reconcileDemoStays(store)
    expect(stayBalance((await store.stays.getById(stayId))!).consumptionBalance).toBe(0)
    expect(await store.consumptions.getTotalByRoomId(6)).toBe(0)
    expect(await store.transactions.count()).toBe(before)
    expect((await store.stockItems.getAll()).find(s => s.productId === "P001")!.currentStock).toBe(stock)
  })
  it("reparte o desconto nos itens sem diferença entre ficha e mapa", async () => {
    await run({ ...input(), globalDiscount: 10, sale: { ...input().sale, total: 9 } })
    expect(stayBalance((await store.stays.getById(stayId))!).consumptionBalance).toBe(9)
    expect(await store.consumptions.getTotalByRoomId(6)).toBe(9)
  })
})


describe("Vendas exigem turno em todos os meios", () => {
  it.each(["pix", "debito", "credito", "dinheiro", "ficha"])("recusa %s sem efeitos", async method => {
    await store.cashCloses.update("DEMO-OPEN-CASH", { status: "fechado" })
    const before = JSON.parse(await store.exportAll())
    const payload = method === "ficha" ? input() : input({ stayId: undefined, amountPaid: 10, payments: [{ method, value: 10 }] })
    await expect(run(payload)).rejects.toThrow("Caixa fechado")
    expect(JSON.parse(await store.exportAll())).toEqual(before)
  })
  it("reenvio confirmado não lança em outro turno", async () => {
    const first = await run(input())
    await store.cashCloses.update("DEMO-OPEN-CASH", { status: "fechado" })
    expect(await run(input())).toEqual(first)
    expect(first.operationalSessionId).toBe("DEMO-OPEN-CASH")
  })
})
