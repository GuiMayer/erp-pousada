import type { PrismaClient } from "@prisma/client"
import { prisma as defaultPrisma } from "../db/client"
import type { IStorageAdapter } from "./types"

type LocalDataClient = Pick<PrismaClient, "localDataEntry" | "$transaction">

export class LocalDatabaseAdapter implements IStorageAdapter {
  private client: LocalDataClient

  constructor(client: LocalDataClient = defaultPrisma) {
    this.client = client
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = await this.client.localDataEntry.findUnique({
      where: { key },
    })

    return entry?.value as T | null
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.client.localDataEntry.upsert({
      where: { key },
      create: { key, value: value as any },
      update: { value: value as any },
    })
  }

  async remove(key: string): Promise<void> {
    await this.client.localDataEntry.deleteMany({
      where: { key },
    })
  }

  async clear(): Promise<void> {
    await this.client.localDataEntry.deleteMany()
  }

  async keys(): Promise<string[]> {
    const entries = await this.client.localDataEntry.findMany({
      select: { key: true },
      orderBy: { key: "asc" },
    })

    return entries.map((entry) => entry.key)
  }

  async export(): Promise<string> {
    const entries = await this.client.localDataEntry.findMany({
      orderBy: { key: "asc" },
    })

    const data = Object.fromEntries(
      entries.map((entry) => [entry.key, entry.value])
    )

    return JSON.stringify(data, null, 2)
  }

  async import(json: string): Promise<void> {
    let data: Record<string, unknown>

    try {
      data = JSON.parse(json)
    } catch {
      throw new Error("Failed to import data: invalid JSON format")
    }

    await this.client.$transaction([
      this.client.localDataEntry.deleteMany(),
      ...Object.entries(data).map(([key, value]) =>
        this.client.localDataEntry.create({
          data: { key, value: value as any },
        })
      ),
    ])
  }

  async getUsage(): Promise<number> {
    const exported = await this.export()
    return Buffer.byteLength(exported, "utf8")
  }
}
