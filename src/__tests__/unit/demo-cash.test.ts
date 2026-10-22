import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createDataStore } from "@/lib/data/repositories"
import { LocalStorageAdapter } from "@/lib/data/storage-adapter"
import { demoCashOperation } from "@/lib/data/demo-cash"

const adapter = new LocalStorageAdapter("cash-workflow-tests")
let store: ReturnType<typeof createDataStore>
const actor = { id: "demo-operator", username: "operator" }
const can = (_p: string) => true
const op = (kind: string, payload: unknown, key = crypto.randomUUID()) => demoCashOperation(store, kind, payload, can, actor, key)
beforeEach(async () => {
  store = createDataStore({ adapter, enableSync: false })
  await store.importAll(JSON.stringify({ cashCloses: [], transactions: [], bankAccounts: [{ id: "bank", name: "Conta", active: true, initialBalance: 500, currentBalance: 500 }] }))
})
afterEach(async () => { await adapter.clear() })
describe("Turnos na demonstração do navegador", () => {
  it("abre uma vez, registra movimentos e transfere o fundo sem criar receita", async () => {
    const key = crypto.randomUUID()
    await op("cash-open", { openingValue: 100 }, key); await op("cash-open", { openingValue: 100 }, key)
    expect(await store.cashCloses.count()).toBe(1)
    await op("cash-movement", { direction: "supply", value: 20, accountId: "bank", reason: "Suprimento teste" })
    await op("cash-close", { sessionId: key, physicalValue: 120, retainedValue: 40 })
    const inspected = await op("cash-inspect", { sessionId: key }) as { incomingValue: number; expectedValue: number; retainedValue: number }
    expect(inspected).toMatchObject({ incomingValue: 20, expectedValue: 120, retainedValue: 40 })
    await expect(op("cash-open", { openingValue: 50 })).rejects.toThrow("motivo")
    await op("cash-open", { openingValue: 40 })
    expect((await store.transactions.getAll()).some(t => t.type === "receita")).toBe(false)
  })
  it("não encerra com diferença sem justificativa e mantém os valores após conferência", async () => {
    const key = crypto.randomUUID(); await op("cash-open", { openingValue: 100 }, key)
    await expect(op("cash-close", { sessionId: key, physicalValue: 90 })).rejects.toMatchObject({ code: "CASH_DIFFERENCE" })
    expect((await store.cashCloses.getById(key))?.status).toBe("aberto")
    await op("cash-close", { sessionId: key, physicalValue: 90, closingReason: "Diferença conferida no turno" })
    await op("cash-review", { sessionId: key, note: "Conferência do supervisor" })
    expect(await store.cashCloses.getById(key)).toMatchObject({ expectedValue: 100, physicalValue: 90, divergence: -10, reviewedBy: "operator" })
  })
  it("retira e deposita sem repetir saldo se tentarem fechar de novo", async () => {
    const key = crypto.randomUUID(); await op("cash-open", { openingValue: 100 }, key)
    const closing = { sessionId: key, physicalValue: 100, retainedValue: 0, withdrawalAccountId: "bank" }
    await op("cash-close", closing)
    await expect(op("cash-close", closing)).rejects.toThrow("já fechado")
    expect((await store.bankAccounts.getById("bank"))?.currentBalance).toBe(600)
    expect(await store.transactions.count()).toBe(1)
  })
  it("recusa falta de saldo e acesso indevido sem deixar meia transferência", async () => {
    const key = crypto.randomUUID(); await op("cash-open", { openingValue: 10 }, key)
    await expect(op("cash-movement", { direction: "withdraw", value: 20, accountId: "bank", reason: "Sangria teste" })).rejects.toThrow("Saldo insuficiente")
    await expect(demoCashOperation(store, "cash-close", { sessionId: key, physicalValue: 10 }, () => false, actor, crypto.randomUUID())).rejects.toThrow("permissão")
    expect(await store.transactions.count()).toBe(0)
    expect((await store.bankAccounts.getById("bank"))?.currentBalance).toBe(500)
  })
})
