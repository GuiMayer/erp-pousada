import type { DataStore } from "./types"
import type { Customer, Supplier } from "@/lib/store"
import { getDataConfig } from "./config"
import { normalizeDocument } from "@/lib/utils/cpf-cnpj-validator"

// Compatibility for the explicit, single-browser example mode. Production
// performs these changes atomically in PostgreSQL through server/contacts.ts.
function demoOnly() { if (getDataConfig().adapter !== "demo-localStorage") throw new Error("Use o serviço de cadastros do servidor") }
export async function syncDemoContact(store: DataStore, person: Customer) {
  demoOnly()
  const roles = person.roles ?? ["payer"]
  const guests = await store.guests.getAll()
  const guest = guests.find(g => g.customerId === person.id || normalizeDocument(g.cpf) === normalizeDocument(person.cpfCnpj))
  if (guest) await store.guests.update(guest.cpf, { customerId: person.id, name: person.name, active: person.active })
  else if (roles.includes("guest")) await store.guests.create({ cpf: person.cpfCnpj, customerId: person.id, name: person.name, active: person.active, totalStays: 0, avgTicket: 0, noShows: 0 })
  const suppliers = await store.suppliers.getAll()
  const supplier = suppliers.find(s => s.customerId === person.id || person.cpfCnpj && normalizeDocument(s.cnpj ?? "") === person.cpfCnpj)
  const fields = { customerId: person.id, name: person.name, cnpj: person.cpfCnpj, email: person.email, phone: person.phone, address: person.address, active: person.active }
  if (supplier) await store.suppliers.update(supplier.id, fields)
  else if (roles.includes("supplier")) await store.suppliers.create(fields)
}
export async function saveDemoSupplier(store: DataStore, supplier: Supplier, editing = false) {
  demoOnly()
  const document = normalizeDocument(supplier.cnpj ?? "")
  const people = await store.customers.getAll()
  let person = people.find(c => c.id === supplier.customerId || document && c.cpfCnpj === document)
  const other = (await store.suppliers.getAll()).find(s => person && s.customerId === person.id && s.id !== supplier.id)
  if (other) throw new Error("Fornecedor já cadastrado; utilize o registro existente")
  if (person) person = await store.customers.update(person.id, { name: supplier.name, cpfCnpj: document, email: supplier.email, phone: supplier.phone, address: supplier.address, active: supplier.active, roles: [...new Set([...(person.roles ?? ["payer"]), "supplier" as const])] })
  else person = await store.customers.create({ name: supplier.name, cpfCnpj: document, roles: ["supplier"], active: supplier.active, email: supplier.email, phone: supplier.phone, address: supplier.address })
  const fields = { ...supplier, customerId: person.id, cnpj: document }
  if (editing) await store.suppliers.update(supplier.id, fields)
  else await store.suppliers.create(fields)
  await syncDemoContact(store, person)
}
