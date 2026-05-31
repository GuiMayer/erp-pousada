import { prisma } from "@/lib/db/client"
import { LocalDatabaseAdapter } from "@/lib/data/local-database-adapter"
import { getCollectionKeys, getCollectionMapper } from "./mappers"

const legacyAdapter = new LocalDatabaseAdapter()

type PrismaModel = {
  findMany(args?: unknown): Promise<unknown[]>
  create(args: { data: unknown }): Promise<unknown>
  update(args: { where: { id: string | number } | Record<string, unknown>; data: unknown }): Promise<unknown>
  delete(args: { where: { id: string | number } | Record<string, unknown> }): Promise<unknown>
  deleteMany(args?: unknown): Promise<unknown>
}

function getModel(modelName: string): PrismaModel {
  return (prisma as unknown as Record<string, PrismaModel>)[modelName]
}

function getWhere(key: string, item: unknown): { id: string | number } | { cpf: string } | { roomId: number } {
  const data = item as Record<string, unknown>

  if (key === "guests") return { cpf: String(data.cpf) }
  if (key === "consumptions") return { roomId: Number(data.roomId) }

  return { id: data.id as string | number }
}

function getWhereFromId(key: string, id: string): { id: string | number } | { cpf: string } | { roomId: number } {
  if (key === "guests") return { cpf: id }
  if (key === "consumptions") return { roomId: Number(id) }
  return { id }
}

export async function getCollection(key: string): Promise<unknown[] | null> {
  const mapper = getCollectionMapper(key)

  if (!mapper) {
    return legacyAdapter.get(key)
  }

  const rows = await getModel(mapper.prismaModel).findMany({
    include: mapper.include,
    orderBy: mapper.orderBy,
  })

  return rows.map(row => mapper.toApp(row as Record<string, unknown>))
}

export async function replaceCollection(key: string, value: unknown): Promise<void> {
  const mapper = getCollectionMapper(key)

  if (!mapper) {
    await legacyAdapter.set(key, value)
    return
  }

  if (!Array.isArray(value)) {
    throw new Error(`Collection ${key} must be an array`)
  }

  const model = getModel(mapper.prismaModel)

  await prisma.$transaction(async () => {
    await model.deleteMany()

    for (const item of value) {
      await model.create({ data: mapper.toCreate(item) })
    }
  })
}

export async function removeCollection(key: string): Promise<void> {
  const mapper = getCollectionMapper(key)

  if (!mapper) {
    await legacyAdapter.remove(key)
    return
  }

  await getModel(mapper.prismaModel).deleteMany()
}

export async function upsertCollectionItem(key: string, item: unknown): Promise<unknown> {
  const mapper = getCollectionMapper(key)

  if (!mapper) {
    const collection = ((await legacyAdapter.get(key)) ?? []) as unknown[]
    await legacyAdapter.set(key, [...collection, item])
    return item
  }

  const model = getModel(mapper.prismaModel)


  try {
    const created = await model.create({ data: mapper.toCreate(item) })
    return mapper.toApp(created as Record<string, unknown>)
  } catch (error: any) {
    if (error?.code !== "P2002") throw error

    const updated = await model.update({
      where: getWhere(key, item),
      data: mapper.toUpdate(item as Record<string, unknown>),
    })

    return mapper.toApp(updated as Record<string, unknown>)
  }
}

export async function updateCollectionItem(key: string, id: string, data: unknown): Promise<unknown> {
  const mapper = getCollectionMapper(key)

  if (!mapper) {
    const collection = ((await legacyAdapter.get(key)) ?? []) as Record<string, unknown>[]
    const next = collection.map(item => (String(item.id) === id ? { ...item, ...(data as object) } : item))
    await legacyAdapter.set(key, next)
    return next.find(item => String(item.id) === id) ?? null
  }

  const updated = await getModel(mapper.prismaModel).update({
    where: getWhereFromId(key, id),
    data: mapper.toUpdate(data as Record<string, unknown>),
  })

  return mapper.toApp(updated as Record<string, unknown>)
}

export async function deleteCollectionItem(key: string, id: string): Promise<void> {
  const mapper = getCollectionMapper(key)

  if (!mapper) {
    const collection = ((await legacyAdapter.get(key)) ?? []) as Record<string, unknown>[]
    await legacyAdapter.set(key, collection.filter(item => String(item.id) !== id))
    return
  }

  await getModel(mapper.prismaModel).delete({ where: getWhereFromId(key, id) })
}

export async function getCollectionNames(): Promise<string[]> {
  const legacyKeys = await legacyAdapter.keys()
  return Array.from(new Set([...getCollectionKeys(), ...legacyKeys])).sort()
}

export async function exportAllCollections(): Promise<string> {
  const data: Record<string, unknown> = {}

  for (const key of await getCollectionNames()) {
    data[key] = await getCollection(key)
  }

  return JSON.stringify(data, null, 2)
}

export async function importAllCollections(json: string): Promise<void> {
  const data = JSON.parse(json) as Record<string, unknown>

  for (const [key, value] of Object.entries(data)) {
    await replaceCollection(key, value)
  }
}

export async function clearAllCollections(): Promise<void> {
  for (const key of getCollectionKeys()) {
    await removeCollection(key)
  }

  await legacyAdapter.clear()
}

export async function getStorageUsageBytes(): Promise<number> {
  return Buffer.byteLength(await exportAllCollections(), "utf8")
}
