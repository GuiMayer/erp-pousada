import { randomUUID } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { z } from "zod"
import { normalizeDocument, validateCpfCnpj, isCPF } from "@/lib/utils/cpf-cnpj-validator"
import { demand } from "./permissions"
import type { Actor } from "./auth"
import { HttpError } from "./http"

type Tx = Prisma.TransactionClient
type Row = Record<string, unknown>
export const contactRoles = z.array(z.enum(["guest", "payer", "supplier"])).min(1).max(3)
const rolesOf = (value: unknown) => contactRoles.parse(value ?? ["payer"])

// Customer is the stable person identity. Guest/supplier remain compatible
// projections; their old keys, balances and historical references are retained.
export async function prepareContact(tx: Tx, key: string, data: Row, current: Row | null, actor?: Actor) {
  if (!["customers", "suppliers", "guests"].includes(key)) return
  if ("customerId" in data) throw new HttpError(400, "A identidade vinculada é gerenciada pelo sistema")
  if (data.name !== undefined) {
    if (typeof data.name !== "string" || !data.name.trim() || data.name.length > 200) throw new HttpError(400, "Informe o nome")
    data.name = data.name.trim()
  }
  const docField = key === "customers" ? "cpfCnpj" : key === "suppliers" ? "cnpj" : "cpf"
  if (data[docField] !== undefined) {
    if (typeof data[docField] !== "string") throw new HttpError(400, "Documento inválido")
    const document = normalizeDocument(data[docField] as string)
    if (document && (!validateCpfCnpj(document) || key === "guests" && !isCPF(document))) throw new HttpError(400, "CPF/CNPJ inválido")
    data[docField] = document
  }
  if (key === "customers") {
    const roles = rolesOf(data.roles ?? current?.roles)
    if (data.roles !== undefined || !current) data.roles = [...new Set(roles)]
    const document = String(data.cpfCnpj ?? current?.cpfCnpj ?? "")
    if (roles.includes("guest") && !isCPF(document)) throw new HttpError(400, "Hóspede precisa de CPF válido")
    if (!document && roles.some(r => r !== "supplier")) throw new HttpError(400, "Informe CPF/CNPJ para hóspede ou pagador")
    if (document) {
      const duplicate = await tx.customer.findFirst({ where: { cpfCnpj: document, ...(current ? { id: { not: String(current.id) } } : {}) } })
      if (duplicate) throw new HttpError(409, "Documento já cadastrado. Busque a pessoa e acrescente o papel necessário")
    }
    const previous = rolesOf(current?.roles)
    if (actor && roles.includes("supplier") && (!current || !previous.includes("supplier"))) demand(actor, "suppliers.create")
    if (current) {
      if (!roles.includes("supplier") && await tx.supplier.findUnique({ where: { customerId: String(current.id) } })) throw new HttpError(409, "Preserve o papel fornecedor; inative o cadastro para suspender seu uso")
      if (!roles.includes("guest") && await tx.guestProfile.findUnique({ where: { customerId: String(current.id) } })) throw new HttpError(409, "Preserve o papel hóspede; o histórico deve continuar vinculado")
    }
    return
  }
  const linked = current?.customerId ? await tx.customer.findUniqueOrThrow({ where: { id: String(current.customerId) } }) : null
  const document = String(data[docField] ?? current?.[docField] ?? "")
  let person = linked ?? (document ? await tx.customer.findFirst({ where: { cpfCnpj: document } }) : null)
  const role = key === "guests" ? "guest" : "supplier"
  if (person) {
    const other = key === "guests" ? await tx.guestProfile.findUnique({ where: { customerId: person.id } }) : await tx.supplier.findUnique({ where: { customerId: person.id } })
    if (other && (!current || ("cpf" in other ? other.cpf !== current.cpf : other.id !== current.id))) throw new HttpError(409, "Pessoa já cadastrada neste papel. Utilize o registro existente")
    const shared: Row = {}
    for (const field of ["name", "email", "phone", "address", "active"]) if (data[field] !== undefined && data[field] !== person[field as keyof typeof person]) shared[field] = data[field]
    if (linked && document !== person.cpfCnpj) shared.cpfCnpj = document
    if (Object.keys(shared).length && actor) demand(actor, "customers.edit")
    const roles = [...new Set([...rolesOf(person.roles), role])]
    await prepareContact(tx, "customers", { ...shared, roles }, person as unknown as Row, actor)
    person = await tx.customer.update({ where: { id: person.id }, data: { ...shared, roles, recordVersion: { increment: 1 } } })
  } else {
    person = await tx.customer.create({ data: { id: randomUUID(), name: String(data.name ?? current?.name), cpfCnpj: document, roles: [role], active: data.active !== false, email: data.email as string | undefined, phone: data.phone as string | undefined, address: data.address as string | undefined } })
  }
  data.customerId = person.id
}

export async function syncContact(tx: Tx, key: string, row: Row) {
  if (key !== "customers") return
  const customerId = String(row.id), roles = rolesOf(row.roles), name = String(row.name), active = row.active !== false
  await tx.guestProfile.updateMany({ where: { customerId }, data: { name, active, recordVersion: { increment: 1 } } })
  await tx.supplier.updateMany({ where: { customerId }, data: { name, cnpj: String(row.cpfCnpj), email: row.email as string | null, phone: row.phone as string | null, address: row.address as string | null, active, recordVersion: { increment: 1 } } })
  if (roles.includes("guest") && !await tx.guestProfile.findUnique({ where: { customerId } })) {
    const legacy = await tx.guestProfile.findUnique({ where: { cpf: String(row.cpfCnpj) } })
    if (legacy?.customerId && legacy.customerId !== customerId) throw new HttpError(409, "CPF possui histórico em outra identidade; revise o cadastro")
    await tx.guestProfile.upsert({ where: { cpf: String(row.cpfCnpj) }, create: { cpf: String(row.cpfCnpj), customerId, name, active }, update: { customerId, name, active } })
  }
  if (roles.includes("supplier") && !await tx.supplier.findUnique({ where: { customerId } })) {
    await tx.supplier.create({ data: { id: randomUUID(), customerId, name, cnpj: String(row.cpfCnpj), email: row.email as string | null, phone: row.phone as string | null, address: row.address as string | null, active } })
  }
}

export async function ensureGuest(tx: Tx, actor: Actor, document: string, name: string) {
  let person = await tx.customer.findFirst({ where: { cpfCnpj: document } })
  if (!person) {
    const legacy = await tx.guestProfile.findUnique({ where: { cpf: document } })
    if (legacy?.customerId) person = await tx.customer.findUnique({ where: { id: legacy.customerId } })
  }
  if (!person) {
    demand(actor, "customers.create")
    person = await tx.customer.create({ data: { id: randomUUID(), cpfCnpj: document, name, roles: ["guest", "payer"] } })
  } else {
    if (!person.active) throw new HttpError(409, "Pessoa inativa. Reative o cadastro antes de reservar")
    if (!rolesOf(person.roles).includes("guest")) {
      demand(actor, "customers.edit")
      person = await tx.customer.update({ where: { id: person.id }, data: { roles: [...rolesOf(person.roles), "guest"], recordVersion: { increment: 1 } } })
    }
  }
  await syncContact(tx, "customers", person as unknown as Row)
  return tx.guestProfile.findUniqueOrThrow({ where: { customerId: person.id } })
}
