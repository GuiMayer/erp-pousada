import { prepareContact, syncContact } from "../contacts"
import { validateTariff } from "../lodging-pricing"
import { requireVersion, removed } from "../concurrency"
import { recordAudit } from "../audit"
import { ruleSchema } from "@/lib/notification-policy"
import { roomStatusEvent } from "../notifications/service"
import { evaluateStock } from "../notifications/rules"
import { ALL_PERMISSIONS, PROFILES, effectivePermissions, operationalCollections } from "@/lib/permissions"
import { can, demand } from "../permissions"
import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { getCollectionKeys, getCollectionMapper } from "./mappers"
import { HttpError } from "../http"
import type { Actor } from "../auth"
import { businessDay } from "@/lib/utils/business-values"

type Client = Prisma.TransactionClient
type Row = Record<string, unknown>
type Model = {
  findMany(args?: unknown): Promise<Row[]>
  findUnique(args: unknown): Promise<Row | null>
  create(args: unknown): Promise<Row>
  update(args: unknown): Promise<Row>
  delete(args: unknown): Promise<Row>
  deleteMany(args?: unknown): Promise<unknown>
}
export const collectionOrder = ["customers", "rooms", "lodgingTariffs", "guests", "suppliers", "bankAccounts", "costCenters", "productCategories", "posProducts", "employees", "recipes", "categories", "systemSettings", "reservations", "expenses", "transactions", "cashCloses", "consumptions", "posSales", "restaurantTables", "restaurantOrders", "stockItems", "stockMovements", "productions", "employeeConsumptions", "accountsReceivable", "bankTransfers", "budgets", "recurringTransactions", "auditLog", "users", "userSessions"]
export const portableKeys = collectionOrder.filter(key => !["users", "userSessions", "auditLog", "systemSettings"].includes(key))
export function collectionMapper(key: string) {
  const mapper = getCollectionMapper(key)
  if (!mapper) throw new HttpError(404, "Coleção não encontrada")
  return mapper
}
function model(key: string, client: Client = prisma): Model {
  return (client as unknown as Record<string, Model>)[collectionMapper(key).prismaModel]
}
export function itemWhere(key: string, id: string) {
  if (key === "guests") return { cpf: id }
  if (key === "consumptions") return { roomId: positiveId(id) }
  return { id: ["rooms", "restaurantTables"].includes(key) ? positiveId(id) : id }
}
function positiveId(id: string): number {
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) throw new HttpError(400, "ID inválido")
  return Number(id)
}
export function sanitizeUser(row: Row): Row {
  const { password: _password, ...safe } = row
  return safe
}
function toApp(key: string, row: Row) {
  const value = { ...collectionMapper(key).toApp(row) as Row, ...(row.recordVersion === undefined ? {} : { recordVersion: row.recordVersion }) }
  return key === "users" ? sanitizeUser(value) : value
}

// Validate mapped data against the actual database schema. Reject relation commands
// supplied by callers; only the server's mappers can construct nested creates.
export function validateMappedData(modelName: string, data: Row, partial = false): Row {
  const spec = Prisma.dmmf.datamodel.models.find(item => item.name[0].toLowerCase() + item.name.slice(1) === modelName)
  if (!spec) throw new HttpError(400, "Modelo inválido")
  const result: Row = {}
  for (const [name, value] of Object.entries(data)) {
    if (name.startsWith("_")) continue
    const field = spec.fields.find(item => item.name === name)
    if (!field) throw new HttpError(400, `Campo inválido: ${name}`)
    if (value === undefined) continue
    if (value === null) { if (field.isRequired) throw new HttpError(400, `Campo obrigatório: ${name}`); result[name] = null; continue }
    if (field.kind === "object") {
      const nested = value as { create?: Row[] }
      if (!nested || Object.keys(nested).some(k => k !== "create") || !Array.isArray(nested.create)) throw new HttpError(400, "Relação inválida")
      // Prisma validates required parent foreign keys supplied through the relation.
      const nestedModel = field.type[0].toLowerCase() + field.type.slice(1)
      result[name] = { create: nested.create.map(row => validateMappedData(nestedModel, row, true)) }
      continue
    }
    if (field.type === "String" && (typeof value !== "string" || value.length > 10000)) throw new HttpError(400, `Texto inválido: ${name}`)
    if (field.type === "Boolean" && typeof value !== "boolean") throw new HttpError(400, `Booleano inválido: ${name}`)
    if (["Int", "Float", "Decimal"].includes(field.type)) {
      if (typeof value !== "number" || !Number.isFinite(value) || (field.type === "Int" && !Number.isSafeInteger(value))) throw new HttpError(400, `Número inválido: ${name}`)
      if (value < 0 && !["currentBalance", "initialBalance", "expectedValue", "divergence", "variance", "variancePercent"].includes(name)) throw new HttpError(400, `Valor negativo: ${name}`)
    }
    if (field.type === "DateTime" && (!(value instanceof Date) || !Number.isFinite(value.getTime()))) throw new HttpError(400, `Data inválida: ${name}`)
    result[name] = value
  }
  if (!partial) for (const field of spec.fields) {
    if (field.kind !== "object" && field.isRequired && !field.hasDefaultValue && result[field.name] === undefined) throw new HttpError(400, `Campo obrigatório: ${field.name}`)
  }
  return result
}
async function mappedInput(key: string, item: unknown, partial: boolean, actor?: Actor) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new HttpError(400, "Registro inválido")
  const input = { ...item } as Row
  for (const field of Object.keys(input)) if (field.startsWith("_")) delete input[field]
  delete input.recordVersion
  delete input.accessVersion
  if (key === "systemSettings") for (const field of ["checkInTime", "checkOutTime"]) if (input[field] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(input[field]))) throw new HttpError(400, "Horário inválido")
  if (key === "systemSettings" && input.notificationRules !== undefined) input.notificationRules = ruleSchema.parse(input.notificationRules)
  if (partial) { delete input.id; delete input.createdAt; delete input.createdBy }
  if (key === "users") {
    if (input.accessProfile !== undefined && (typeof input.accessProfile !== "string" || !PROFILES[input.accessProfile])) throw new HttpError(400, "Perfil de acesso inválido")
    if (input.permissionOverrides !== undefined) {
      const overrides = input.permissionOverrides
      if (!overrides || typeof overrides !== "object" || Array.isArray(overrides) || Object.entries(overrides).some(([key, value]) => !ALL_PERMISSIONS.includes(key) || !["allow", "deny"].includes(String(value)))) throw new HttpError(400, "Permissões inválidas")
    }

    if (input.role !== undefined && input.accessProfile === undefined) { input.accessProfile = input.role === "supervisor" ? "administrador" : "operador_legado"; input.permissionOverrides = {} }
    if (input.username !== undefined) input.username = String(input.username).trim().toLowerCase()
    if (input.role !== undefined && !["supervisor", "operador"].includes(String(input.role))) throw new HttpError(400, "Perfil inválido")
    if (input.password !== undefined) {
      if (typeof input.password !== "string" || input.password.length < 12 || Buffer.byteLength(input.password, "utf8") > 72) throw new HttpError(400, "Use uma senha de 12 a 72 caracteres")
      input.password = await bcrypt.hash(input.password, 12)
    }
    if (!partial) { input.createdBy = actor?.username ?? "setup"; input.createdAt = new Date().toISOString() }
  }
  if (actor) {
    if (key === "guests" && input.creditValue !== undefined) throw new HttpError(403, "Crédito é gerenciado pelo financeiro")
    if (["expenses", "accountsReceivable"].includes(key)) {
      if (input.paid === true || input.status === "pago" || input.paymentDate !== undefined) throw new HttpError(403, "Utilize o fluxo de pagamento")
      const parts = input.installments as Row[] | undefined
      if (parts && (!Array.isArray(parts) || parts.some(part => Number(part.value) <= 0 || part.paid === true || part.status === "pago") || Math.abs(parts.reduce((sum, part) => sum + Number(part.value), 0) - Number(input.value)) > 0.001)) throw new HttpError(400, "Parcelas devem ser positivas e somar o valor do título")
    }
    if (key === "bankAccounts" && !partial) input.currentBalance = input.initialBalance
  }
  if (key === "auditLog" && actor) input.user = actor.username
  const mapper = collectionMapper(key)
  const mapped = partial ? mapper.toUpdate(input) : mapper.toCreate(input)
  // Omitted PATCH fields must never be populated by create-mapper defaults.
  const data = partial ? Object.fromEntries(Object.entries(mapped).filter(([field]) => Object.hasOwn(input, field))) : mapped
  return validateMappedData(mapper.prismaModel, data, partial)
}
async function validateCatalog(client: Client, key: string, data: Row, current?: Row) {
  if (key === "rooms" && data.capacity !== undefined && data.capacity !== null && (!Number.isInteger(data.capacity) || Number(data.capacity) < 1 || Number(data.capacity) > 100)) throw new HttpError(400, "Capacidade deve ser de 1 a 100 pessoas")
  if (key === "rooms" && current && data.capacity !== undefined) {
    if (data.capacity === null && current.capacity !== null) throw new HttpError(409, "Um quarto configurado deve conservar sua capacidade")
    if (data.capacity !== null && await client.reservation.count({ where: { roomId: Number(current.id), status: { in: ["confirmada", "checkin"] }, guestCount: { gt: Number(data.capacity) }, checkOut: { gt: new Date(businessDay()) } } })) throw new HttpError(409, "Capacidade inferior à ocupação de reserva ativa")
  }
  if (key !== "posProducts") return
  if (data.name !== undefined && !String(data.name).trim()) throw new HttpError(400, "Informe o nome da bebida")
  if (data.price !== undefined && (Number(data.price) <= 0 || Math.abs(Number(data.price) * 100 - Math.round(Number(data.price) * 100)) > .00001)) throw new HttpError(400, "Preço deve ser positivo, com até duas casas decimais")
  if (data.unit !== undefined && !["un", "ml", "l"].includes(String(data.unit))) throw new HttpError(400, "Unidade inválida")
  if (data.unit !== undefined && current && data.unit !== current.unit && await client.stockItem.findUnique({ where: { productId: String(current.id) } })) throw new HttpError(409, "Bebida com estoque: preserve a unidade base para manter o histórico")
  if (data.barcode !== undefined) {
    const barcode = String(data.barcode ?? "").trim()
    if (barcode && await client.pOSProduct.findFirst({ where: { barcode, ...(current ? { id: { not: String(current.id) } } : {}) } })) throw new HttpError(409, "Código de barras já cadastrado")
    data.barcode = barcode || null
  }
}
export async function getCollection(key: string, client: Client = prisma): Promise<unknown[]> {
  const mapper = collectionMapper(key)
  return (await model(key, client).findMany({ include: mapper.include, orderBy: mapper.orderBy })).map(row => toApp(key, row))
}
async function currentActor(client: Client, actor: Actor | undefined) {
  if (!actor) return undefined
  if (actor.permissions) {
    const user = await client.user.findUnique({ where: { id: actor.id } })
    const session = await client.authSession.findUnique({ where: { id: actor.sessionId } })
    if (!user?.active || !session || session.expiresAt <= new Date()) throw new HttpError(401, "Sessão expirada")
    actor = { ...actor, permissions: effectivePermissions(user), permissionOverrides: user.permissionOverrides as Actor["permissionOverrides"] }
  }
  return actor
}
async function mutationActor(client: Client, actor: Actor | undefined, key: string, operation: string) {
  actor = await currentActor(client, actor)
  if (!actor) return undefined
  if ([...operationalCollections, "auditLog", "userSessions"].includes(key)) throw new HttpError(403, "Utilize a operação específica")
  demand(actor, `${key}.${operation}`)
  if (key === "users") demand(actor, "users.manage")
  return actor
}
const managesUsers = (user: Parameters<typeof effectivePermissions>[0]) => ["users.manage", "users.read", "users.create", "users.edit"].every(key => effectivePermissions(user).includes(key))
async function checkUserChange(client: Client, id: string | undefined, input: Row, actor?: Actor, deleting = false) {
  const current = id ? await client.user.findUniqueOrThrow({ where: { id } }) : null
  const next = { ...(current ?? {}), ...input }
  if (actor) {
    demand(actor, "users.manage")
    // Editing credentials of a more privileged account also grants its powers.
    if (effectivePermissions(next).some(key => !can(actor, key)) || current && effectivePermissions(current).some(key => !can(actor, key))) throw new HttpError(403, "Você não pode administrar ou conceder acessos superiores aos seus")
  }
  if (current?.active && managesUsers(current) && (deleting || next.active === false || !managesUsers(next))) {
    const others = await client.user.findMany({ where: { active: true, id: { not: id } } })
    if (!others.some(managesUsers)) throw new HttpError(409, "Mantenha ao menos um administrador ativo")
  }
}
async function mutationAudit(client: Client, actor: Actor | undefined, key: string, operation: string, id: string, before?: Row | null, after?: Row) {
  if (!actor) return
  const access = (row?: Row | null) => row ? Object.fromEntries(["role", "active", "accessProfile", "permissionOverrides", "accessVersion"].map(field => [field, row[field] ?? null])) : null
  const metadata = key === "users" ? { before: access(before), after: access(after) } : { before, after }
  await recordAudit(client, actor, `${key}: ${operation}`, id, { metadata, entityType: key, entityId: id, operation })
}
async function revokeUserSessions(client: Client, id: string) {
  await client.userSession.updateMany({ where: { userId: id, logoutTime: null }, data: { logoutTime: new Date() } })
  await client.authSession.deleteMany({ where: { userId: id } })
  await client.operationApproval.deleteMany({ where: { OR: [{ requesterId: id }, { approverId: id }] } })
}
export async function createCollectionItem(key: string, item: unknown, actor?: Actor, client: Client = prisma): Promise<unknown> {
  if (client === prisma && actor) return prisma.$transaction(tx => createCollectionItem(key, item, actor, tx), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  actor = await mutationActor(client, actor, key, "create")
  if (key === "users") await checkUserChange(client, undefined, item as Row, actor)
  const input = await mappedInput(key, item, false, actor)
  if (actor) await prepareContact(client, key, input, null, actor)
  if (key === "lodgingTariffs") await validateTariff(client, input)
  await validateCatalog(client, key, input)
  let row = await model(key, client).create({ data: input, include: collectionMapper(key).include })
  if (actor) await syncContact(client, key, row)
  if (actor && ["suppliers", "guests"].includes(key) && row.customerId) await syncContact(client, "customers", await client.customer.findUniqueOrThrow({ where: { id: String(row.customerId) } }) as unknown as Row)
  if (actor && ["suppliers", "guests"].includes(key)) row = (await model(key, client).findUnique({ where: itemWhere(key, String(row.id ?? row.cpf)), include: collectionMapper(key).include }))!
  await mutationAudit(client, actor, key, "create", String(row.id ?? row.cpf), null, row)
  if (key === "stockItems" && actor) await evaluateStock(client)
  return toApp(key, row)
}
// Compatibility name used by the migration script. Creation is deliberately not an upsert.
export const upsertCollectionItem = createCollectionItem
export async function updateCollectionItem(key: string, id: string, data: unknown, actor?: Actor, client: Client = prisma): Promise<unknown> {
  if (client === prisma) return prisma.$transaction(tx => updateCollectionItem(key, id, data, actor, tx), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  actor = await mutationActor(client, actor, key, "edit")
  const input = await mappedInput(key, data, true, actor)
  const snapshot = await model(key, client).findUnique({ where: itemWhere(key, id) })
  if (!snapshot) throw removed()
  if (actor) await prepareContact(client, key, input, snapshot, actor)
  if (key === "lodgingTariffs") await validateTariff(client, input, snapshot)
  await validateCatalog(client, key, input, snapshot)
  if (snapshot.recordVersion !== undefined) {
    const expected = (data as Row).recordVersion
    if (actor) requireVersion(expected, snapshot.recordVersion)
    input.recordVersion = { increment: 1 }
  }
  if (key === "users") {
    await checkUserChange(client, id, input, actor)
    if (["accessProfile", "permissionOverrides", "role", "active", "password"].some(key => Object.hasOwn(input, key))) input.accessVersion = { increment: 1 }
  }
  if (actor) {
    const current = await model(key, client).findUnique({ where: itemWhere(key, id) })
    if (key === "rooms" && current && ["ocupado", "limpeza"].includes(String(current.status)) && ["status", "guest", "guestCpf", "checkIn", "checkOut"].some(field => Object.prototype.hasOwnProperty.call(data, field))) throw new HttpError(409, "Utilize o fluxo de hospedagem para alterar a ocupação")
    if (key === "rooms" && input.status === "ocupado") throw new HttpError(409, "Utilize check-in")
    if (key === "rooms" && input.status === "bloqueado") {
      const end = input.blockEndDate === undefined ? current?.blockEndDate : input.blockEndDate
      if (await client.reservation.count({ where: { roomId: Number(id), status: { in: ["confirmada", "checkin"] }, checkOut: { gt: new Date(businessDay()) }, ...(end ? { checkIn: { lte: end as Date } } : {}) } })) throw new HttpError(409, "Bloqueio coincide com reserva ou hospedagem; resolva o período antes")
    }
    if (key === "bankAccounts" && current && ["initialBalance", "currentBalance"].some(field => input[field] !== undefined && Number(input[field]) !== Number(current[field]))) throw new HttpError(409, "Saldo é alterado por pagamentos e transferências")
    if (["expenses", "accountsReceivable"].includes(key) && current && (current.paid === true || current.status === "pago")) throw new HttpError(409, "Título pago não pode ser alterado")
    if (key === "expenses" && await client.expenseInstallment.count({ where: { expenseId: id, paid: true } })) throw new HttpError(409, "Título possui parcelas pagas e não pode ser alterado")
    if (key === "accountsReceivable" && await client.accountReceivableInstallment.count({ where: { accountReceivableId: id, status: "pago" } })) throw new HttpError(409, "Título possui parcelas recebidas e não pode ser alterado")
  }
  let updated = await model(key, client).update({ where: { ...itemWhere(key, id), ...(actor && snapshot.recordVersion !== undefined ? { recordVersion: snapshot.recordVersion } : {}) }, data: input, include: collectionMapper(key).include })
  if (actor) await syncContact(client, key, updated)
  if (actor && ["suppliers", "guests"].includes(key) && updated.customerId) await syncContact(client, "customers", await client.customer.findUniqueOrThrow({ where: { id: String(updated.customerId) } }) as unknown as Row)
  if (actor && ["suppliers", "guests"].includes(key)) updated = (await model(key, client).findUnique({ where: itemWhere(key, id), include: collectionMapper(key).include }))!
  if (key === "recipes" && (data as Row).ingredients !== undefined) {
    const ingredients = (data as Row).ingredients
    if (!Array.isArray(ingredients) || ingredients.length > 100) throw new HttpError(400, "Ingredientes inválidos")
    const rows = ingredients.map(value => {
      const item = value as Row
      return validateMappedData("recipeIngredient", { id: randomUUID(), recipeId: id, productId: item.productId, productName: item.productName, quantity: item.quantity, unit: item.unit, cost: item.cost })
    })
    await client.recipeIngredient.deleteMany({ where: { recipeId: id } })
    for (const row of rows) await client.recipeIngredient.create({ data: row as unknown as Prisma.RecipeIngredientUncheckedCreateInput })
    updated = (await model(key, client).findUnique({ where: itemWhere(key, id), include: collectionMapper(key).include }))!
  }

  if (key === "users") {
    if (input.password || input.active === false) await revokeUserSessions(client, id)
    else if (input.accessVersion) await client.operationApproval.deleteMany({ where: { approverId: id } })
  }
  await mutationAudit(client, actor, key, "update", id, snapshot, updated)
  if (key === "rooms") await roomStatusEvent(client, actor, id, snapshot?.status, updated.status)
  if (key === "stockItems") await evaluateStock(client)
  return toApp(key, updated)
}
export async function deleteCollectionItem(key: string, id: string, client: Client = prisma, actor?: Actor, expectedVersion?: number): Promise<void> {
  if (client === prisma) return prisma.$transaction(tx => deleteCollectionItem(key, id, tx, actor, expectedVersion), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  actor = await mutationActor(client, actor, key, "delete")
  const snapshot = await model(key, client).findUnique({ where: itemWhere(key, id) })
  if (!snapshot) throw removed()
  if (actor && snapshot.recordVersion !== undefined) requireVersion(expectedVersion, snapshot.recordVersion)
  if (key === "rooms" && await client.lodgingTariff.count({ where: { roomId: Number(id) } })) throw new HttpError(409, "Quarto possui tarifas vinculadas; preserve o cadastro e seu histórico")
  if (["customers", "suppliers", "guests", "posProducts", "lodgingTariffs"].includes(key)) {
    const updated = await model(key, client).update({ where: itemWhere(key, id), data: { active: false, recordVersion: { increment: 1 } } })
    if (actor) await syncContact(client, key, updated)
    if (["suppliers", "guests"].includes(key) && snapshot.customerId) {
      if (actor) demand(actor, "customers.edit")
      const person = await client.customer.update({ where: { id: String(snapshot.customerId) }, data: { active: false, recordVersion: { increment: 1 } } })
      await syncContact(client, "customers", person as unknown as Row)
    }
    await mutationAudit(client, actor, key, "update", id, snapshot, updated)
    return
  }
  if (key === "users") {
    await checkUserChange(client, id, {}, actor, true)
    await revokeUserSessions(client, id)
    await client.user.update({ where: { id }, data: { active: false, accessVersion: { increment: 1 } } })
    await mutationAudit(client, actor, key, "delete", id)
    return
  }
  if (["expenses", "accountsReceivable", "guests"].includes(key)) {
    const current = await model(key, client).findUnique({ where: itemWhere(key, id) })
    if (current && (current.paid === true || current.status === "pago" || Number(current.creditValue || 0) > 0)) throw new HttpError(409, "Registro possui pagamento ou crédito e não pode ser excluído")
  }
  if (key === "expenses" && await client.expenseInstallment.count({ where: { expenseId: id, paid: true } })) throw new HttpError(409, "Título possui parcelas pagas")
  if (key === "accountsReceivable" && await client.accountReceivableInstallment.count({ where: { accountReceivableId: id, status: "pago" } })) throw new HttpError(409, "Título possui parcelas recebidas")
  await model(key, client).delete({ where: { ...itemWhere(key, id), ...(actor && snapshot.recordVersion !== undefined ? { recordVersion: snapshot.recordVersion } : {}) } })
  await mutationAudit(client, actor, key, "delete", id)
}
export async function replaceCollection(key: string, value: unknown) {
  if (!Array.isArray(value)) throw new HttpError(400, "Coleção deve ser uma lista")
  await prisma.$transaction(async tx => {
    await model(key, tx).deleteMany()
    for (const item of value) await createCollectionItem(key, item, undefined, tx)
  })
}
export async function removeCollection(key: string) { await model(key).deleteMany() }
export async function getCollectionNames() { return getCollectionKeys() }
export async function exportAllCollections() {
  return prisma.$transaction(async tx => {
    const data: Row = {}
    for (const key of portableKeys) data[key] = await getCollection(key, tx)
    return JSON.stringify(data)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
}
export async function importAllCollections(json: string, actor?: Actor) {
  let data: Row
  try { data = JSON.parse(json) } catch { throw new HttpError(400, "JSON inválido") }
  if (!data || Array.isArray(data) || typeof data !== "object" || Object.keys(data).some(k => !portableKeys.includes(k))) throw new HttpError(400, "Importação contém coleções não permitidas")
  // Partial replacement would break references: portable imports are full snapshots.
  if (portableKeys.some(k => !Array.isArray(data[k]))) throw new HttpError(400, "Envie uma exportação completa")
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74192026)`
    actor = await currentActor(tx, actor)
    if (actor) demand(actor, "data.restore")
    for (const key of [...portableKeys].reverse()) await model(key, tx).deleteMany()
    for (const key of portableKeys) for (const item of data[key] as unknown[]) await createCollectionItem(key, item, undefined, tx)
    await resetSessionsAfterRestore(tx, actor, "Dados restaurados")
  }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
export async function clearAllCollections(actor?: Actor) {
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74192026)`
    actor = await currentActor(tx, actor)
    if (actor) demand(actor, "data.restore")
    for (const key of [...portableKeys].reverse()) await model(key, tx).deleteMany()
    await resetSessionsAfterRestore(tx, actor, "Dados operacionais apagados")
  }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
export async function getStorageUsageBytes() { return Buffer.byteLength(await exportAllCollections(), "utf8") }

async function resetSessionsAfterRestore(tx: Client, actor: Actor | undefined, action: string) {
  if (!actor) return
  await recordAudit(tx, actor, action, "Todas as coleções operacionais", { entityType: "database", operation: "action" })
  await tx.userSession.updateMany({ where: { logoutTime: null }, data: { logoutTime: new Date() } })
  await tx.authSession.deleteMany()
  await tx.operationApproval.deleteMany()
}
