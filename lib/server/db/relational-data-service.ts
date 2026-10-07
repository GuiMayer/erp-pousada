import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { getCollectionKeys, getCollectionMapper } from "./mappers"
import { HttpError } from "../http"
import type { Actor } from "../auth"

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
export const collectionOrder = ["rooms", "guests", "suppliers", "customers", "bankAccounts", "costCenters", "productCategories", "posProducts", "employees", "recipes", "categories", "systemSettings", "reservations", "expenses", "transactions", "cashCloses", "consumptions", "posSales", "restaurantTables", "restaurantOrders", "stockItems", "stockMovements", "productions", "employeeConsumptions", "accountsReceivable", "bankTransfers", "budgets", "recurringTransactions", "auditLog", "users", "userSessions"]
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
  const value = collectionMapper(key).toApp(row) as Row
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
  if (partial) { delete input.id; delete input.createdAt; delete input.createdBy }
  if (key === "users") {
    if (input.username !== undefined) input.username = String(input.username).trim().toLowerCase()
    if (input.role !== undefined && !["supervisor", "operador"].includes(String(input.role))) throw new HttpError(400, "Perfil inválido")
    if (input.password !== undefined) {
      if (typeof input.password !== "string" || input.password.length < 12 || Buffer.byteLength(input.password, "utf8") > 72) throw new HttpError(400, "Use uma senha de 12 a 72 caracteres")
      input.password = await bcrypt.hash(input.password, 12)
    }
    if (!partial) { input.createdBy = actor?.username ?? "setup"; input.createdAt = new Date().toISOString() }
  }
  if (key === "auditLog" && actor) input.user = actor.username
  const mapper = collectionMapper(key)
  const data = partial ? mapper.toUpdate(input) : mapper.toCreate(input)
  return validateMappedData(mapper.prismaModel, data, partial)
}
export async function getCollection(key: string, client: Client = prisma): Promise<unknown[]> {
  const mapper = collectionMapper(key)
  return (await model(key, client).findMany({ include: mapper.include, orderBy: mapper.orderBy })).map(row => toApp(key, row))
}
export async function createCollectionItem(key: string, item: unknown, actor?: Actor, client: Client = prisma) {
  const row = await model(key, client).create({ data: await mappedInput(key, item, false, actor), include: collectionMapper(key).include })
  return toApp(key, row)
}
// Compatibility name used by the migration script. Creation is deliberately not an upsert.
export const upsertCollectionItem = createCollectionItem
export async function updateCollectionItem(key: string, id: string, data: unknown, actor?: Actor, client: Client = prisma): Promise<unknown> {
  if (client === prisma) return prisma.$transaction(tx => updateCollectionItem(key, id, data, actor, tx), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  const input = await mappedInput(key, data, true, actor)
  if (key === "users" && (input.active === false || input.role === "operador")) {
    const current = await client.user.findUnique({ where: { id } })
    if (current?.active && current.role === "supervisor" && await client.user.count({ where: { role: "supervisor", active: true } }) <= 1) throw new HttpError(409, "Mantenha ao menos um supervisor ativo")
  }
  if (key === "recipes" && (data as Row).ingredients !== undefined) {
    const ingredients = (data as Row).ingredients
    if (!Array.isArray(ingredients) || ingredients.length > 100) throw new HttpError(400, "Ingredientes inválidos")
    const rows = ingredients.map(value => {
      const item = value as Row
      return validateMappedData("recipeIngredient", { id: randomUUID(), recipeId: id, productId: item.productId, productName: item.productName, quantity: item.quantity, unit: item.unit, cost: item.cost })
    })
    await client.recipeIngredient.deleteMany({ where: { recipeId: id } })
    for (const row of rows) await client.recipeIngredient.create({ data: row as unknown as Prisma.RecipeIngredientUncheckedCreateInput })
  }
  const updated = await model(key, client).update({ where: itemWhere(key, id), data: input, include: collectionMapper(key).include })
  if (key === "users" && (input.password || input.active === false || input.role)) await client.authSession.deleteMany({ where: { userId: id } })
  return toApp(key, updated)
}
export async function deleteCollectionItem(key: string, id: string, client: Client = prisma): Promise<void> {
  if (client === prisma) return prisma.$transaction(tx => deleteCollectionItem(key, id, tx), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  if (key === "users") {
    const current = await client.user.findUnique({ where: { id } })
    if (current?.active && current.role === "supervisor" && await client.user.count({ where: { active: true, role: "supervisor" } }) <= 1) throw new HttpError(409, "Mantenha ao menos um supervisor ativo")
  }
  await model(key, client).delete({ where: itemWhere(key, id) })
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
export async function importAllCollections(json: string) {
  let data: Row
  try { data = JSON.parse(json) } catch { throw new HttpError(400, "JSON inválido") }
  if (!data || Array.isArray(data) || typeof data !== "object" || Object.keys(data).some(k => !portableKeys.includes(k))) throw new HttpError(400, "Importação contém coleções não permitidas")
  // Partial replacement would break references: portable imports are full snapshots.
  if (portableKeys.some(k => !Array.isArray(data[k]))) throw new HttpError(400, "Envie uma exportação completa")
  await prisma.$transaction(async tx => {
    for (const key of [...portableKeys].reverse()) await model(key, tx).deleteMany()
    for (const key of portableKeys) for (const item of data[key] as unknown[]) await createCollectionItem(key, item, undefined, tx)
  }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
export async function clearAllCollections() {
  await prisma.$transaction(async tx => {
    for (const key of [...portableKeys].reverse()) await model(key, tx).deleteMany()
  }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
export async function getStorageUsageBytes() { return Buffer.byteLength(await exportAllCollections(), "utf8") }
