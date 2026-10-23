import { beforeEach, afterEach, describe, it, expect } from "vitest"
import { createDataStore } from "@/lib/data/repositories"
import { LocalStorageAdapter } from "@/lib/data/storage-adapter"
import { createDemoData } from "@/lib/demo-data"
import { demoCardPayout } from "@/lib/data/demo-card-payout"
import { demoLedger } from "@/lib/data/demo-ledger"
import { withDemoTransaction } from "@/lib/data/demo-transaction"

const adapter = new LocalStorageAdapter("card-payout-tests")
let store: ReturnType<typeof createDataStore>
beforeEach(async () => { store = createDataStore({ adapter, enableSync: false }); await store.importAll(JSON.stringify(createDemoData())) })
afterEach(async () => { await adapter.clear() })
describe("Cartões e repasses", () => {
  it("despesa por débito sai do banco sem reduzir cartões a receber", async () => {
    const bank = (await store.bankAccounts.getById("DEMO-BANK"))!, card = (await store.bankAccounts.getById("CARDS-CLEARING"))!
    await withDemoTransaction(store, staged => demoLedger(staged, { date: new Date().toISOString(), description: "Fornecedor fictício", type: "despesa", value: 20, paymentMethod: "debito", accountId: bank.id }))
    expect((await store.bankAccounts.getById(bank.id))!.currentBalance).toBe(bank.currentBalance - 20)
    expect((await store.bankAccounts.getById(card.id))!.currentBalance).toBe(card.currentBalance)
  })
  it("cartão não aumenta banco, repasse com taxa não cria receita ou turno", async () => {
    const bank = (await store.bankAccounts.getById("DEMO-BANK"))!, card = (await store.bankAccounts.getById("CARDS-CLEARING"))!
    await store.cashCloses.update("DEMO-OPEN-CASH", { status: "fechado" })
    await withDemoTransaction(store, staged => demoLedger(staged, { date: new Date().toISOString(), description: "Diária", type: "receita", value: 100, paymentMethod: "credito", responsible: "Ana" }))
    expect((await store.bankAccounts.getById(bank.id))!.currentBalance).toBe(bank.currentBalance)
    expect((await store.bankAccounts.getById(card.id))!.currentBalance).toBe(card.currentBalance + 100)
    const input = { fromAccountId: card.id, toAccountId: bank.id, gross: 100, fee: 3 }
    await demoCardPayout(store, input, () => true, "Ana", "repasse-1")
    await demoCardPayout(store, input, () => true, "Ana", "repasse-1")
    expect((await store.bankAccounts.getById(bank.id))!.currentBalance).toBe(bank.currentBalance + 97)
    expect((await store.bankAccounts.getById(card.id))!.currentBalance).toBe(card.currentBalance)
    const lines = (await store.transactions.getAll()).filter(t => t.originId === "repasse-1")
    expect(lines).toHaveLength(3)
    expect(lines.some(t => t.type === "receita" || t.operationalSessionId)).toBe(false)
    expect(lines.find(t => t.type === "despesa")!.value).toBe(3)
    expect((await store.transactions.getAll()).find(t => t.description === "Diária")!.operationalSessionId).toBeUndefined()
  })
  it("recusa conta de PIX como controle de cartão, saldo insuficiente e falta de permissão sem efeitos", async () => {
    const before = JSON.parse(await store.exportAll())
    await expect(withDemoTransaction(store, staged => demoLedger(staged, { date: new Date().toISOString(), description: "Teste", type: "receita", value: 10, paymentMethod: "credito", accountId: "DEMO-BANK" }))).rejects.toThrow("conta ativa")
    const input = { fromAccountId: "CARDS-CLEARING", toAccountId: "DEMO-BANK", gross: 9999999, fee: 0 }
    await expect(demoCardPayout(store, input, () => true, "Ana", "fail")).rejects.toThrow("saldo")
    await expect(demoCardPayout(store, input, () => false, "Ana", "fail")).rejects.toThrow("permissão")
    expect(JSON.parse(await store.exportAll())).toEqual(before)
  })
})
