import { afterEach, describe, expect, it, vi } from "vitest"
import { createDataStore } from "@/lib/data/repositories"
import { LocalStorageAdapter } from "@/lib/data/storage-adapter"
import { saveDemoSupplier, syncDemoContact } from "@/lib/data/demo-contacts"

afterEach(() => vi.unstubAllEnvs())
describe("Identidades no modo de exemplos do navegador", () => {
  it("reaproveita o pagador como fornecedor sem duplicar a pessoa", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "demo-localStorage")
    const store = createDataStore({ adapter: new LocalStorageAdapter(`contacts-${crypto.randomUUID()}`), enableSync: false })
    const company = await store.customers.create({ name: "Empresa", cpfCnpj: "12ABC34501DE35", roles: ["payer"], active: true })
    await saveDemoSupplier(store, { id: "supplier", name: "Empresa", cnpj: "12.abc.345/01de-35", active: true })
    expect(await store.customers.getAll()).toHaveLength(1)
    expect(await store.suppliers.getById("supplier")).toMatchObject({ customerId: company.id })
    expect(await store.customers.getById(company.id)).toMatchObject({ roles: ["payer", "supplier"] })
    await expect(saveDemoSupplier(store, { id: "duplicate", name: "Empresa", cnpj: company.cpfCnpj, active: true })).rejects.toThrow("já cadastrado")
  })
  it("corrige documento e inativa sem perder chave antiga nem crédito", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "demo-localStorage")
    const store = createDataStore({ adapter: new LocalStorageAdapter(`contacts-${crypto.randomUUID()}`), enableSync: false })
    let person = await store.customers.create({ name: "Pessoa", cpfCnpj: "52998224725", roles: ["guest", "payer"], active: true })
    await syncDemoContact(store, person)
    await store.guests.update("52998224725", { creditValue: 80 })
    person = await store.customers.update(person.id, { cpfCnpj: "11144477735", active: false })
    await syncDemoContact(store, person)
    expect(await store.guests.getAll()).toHaveLength(1)
    expect(await store.guests.getById("52998224725")).toMatchObject({ customerId: person.id, active: false, creditValue: 80 })
  })
  it("recusa acesso ao armazenamento de exemplos no modo operacional", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    const store = createDataStore({ adapter: new LocalStorageAdapter(`contacts-${crypto.randomUUID()}`), enableSync: false })
    await expect(syncDemoContact(store, { id: "person", name: "Pessoa", cpfCnpj: "52998224725", active: true, createdAt: "", updatedAt: "" })).rejects.toThrow("servidor")
  })
})
