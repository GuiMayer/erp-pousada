import { BaseRepository } from "./base-repository"
import type { IStorageAdapter } from "../types"
import type { Stay } from "@/lib/stays"
export class StayRepository extends BaseRepository<Stay> {
  constructor(adapter: IStorageAdapter, userId?: string) { super(adapter, "stays", { userId }) }
  protected generateId() { return crypto.randomUUID() }
}
