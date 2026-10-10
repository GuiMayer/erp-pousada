import { afterEach, describe, expect, it, vi } from "vitest"
import { companyLinkError, suggestPayerId } from "@/lib/customer-company"
import type { Customer } from "@/lib/store"
import { createDataStore } from "@/lib/data/repositories"
import { LocalStorageAdapter } from "@/lib/data/storage-adapter"

const company: Customer = { id: "company", name: "Empresa", cpfCnpj: "12ABC34501DE35", roles: ["payer"], active: true, createdAt: "", updatedAt: "" }
const person: Customer = { ...company, id: "person", name: "Pessoa", cpfCnpj: "52998224725", roles: ["guest", "payer"], companyId: company.id }
afterEach(() => vi.unstubAllEnvs())
describe("Vínculo de pessoa com empresa", () => {
  it("sugere a empresa ativa ou o próprio hóspede quando não há vínculo elegível", () => {
    expect(suggestPayerId(person, [company])).toBe(company.id)
    expect(suggestPayerId(person, [{ ...company, active: false }])).toBe(person.id)
    expect(suggestPayerId({ ...person, companyId: null }, [company])).toBe(person.id)
    expect(suggestPayerId({ ...person, active: false }, [company])).toBe("")
  })
  it("não sugere empresa que perdeu o papel de pagador", () => {
    expect(suggestPayerId(person, [{ ...company, roles: ["supplier"] }])).toBe(person.id)
  })
  it("recusa empresa como funcionário, auto vínculo e alvo sem CNPJ", () => {
    expect(companyLinkError({ ...company, companyId: person.id }, [person])).toMatch(/pessoa com CPF/)
    expect(companyLinkError({ ...person, companyId: person.id }, [person])).toMatch(/si mesma/)
    expect(companyLinkError({ ...person, companyId: "other" }, [{ ...person, id: "other" }])).toMatch(/CNPJ/)
  })
  it("mantém vínculo histórico com empresa inativa mas recusa associação nova", () => {
    const inactive = { ...company, active: false }
    expect(companyLinkError(person, [inactive], person)).toBeUndefined()
    expect(companyLinkError(person, [inactive], { ...person, companyId: null })).toMatch(/Reative/)
  })
  it("protege CNPJ e papel do pagador que possui pessoas vinculadas", () => {
    expect(companyLinkError({ ...company, roles: ["supplier"] }, [person], company)).toMatch(/pessoas vinculadas/)
    expect(companyLinkError({ ...company, cpfCnpj: person.cpfCnpj }, [person], company)).toMatch(/pessoas vinculadas/)
  })
  it("persiste, troca e remove o vínculo no modo de exemplos sem duplicar pessoas", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "demo-localStorage")
    const store = createDataStore({ adapter: new LocalStorageAdapter(`company-${crypto.randomUUID()}`), enableSync: false })
    const employer = await store.customers.create(company)
    const employee = await store.customers.create({ ...person, id: undefined, companyId: employer.id })
    expect(employee.companyId).toBe(employer.id)
    await expect(store.customers.update(employer.id, { roles: ["supplier"] })).rejects.toThrow("pessoas vinculadas")
    await store.customers.update(employer.id, { active: false })
    await expect(store.customers.create({ ...person, id: "second", cpfCnpj: "11144477735", companyId: employer.id })).rejects.toThrow("Reative")
    await store.customers.update(employee.id, { notes: "Vínculo anterior" })
    const unlinked = await store.customers.update(employee.id, { companyId: null })
    expect(unlinked.companyId).toBeNull()
    expect(await store.customers.getAll()).toHaveLength(2)
  })
})
