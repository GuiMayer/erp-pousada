import type { DataStore, IStorageAdapter } from "./types"
import { createDataStore } from "./repositories"

let queue: Promise<unknown> = Promise.resolve()

/** Staging keeps failed demo commands from leaving half an entry or a receipt behind. */
export function withDemoTransaction<T>(store: DataStore, apply: (staged: DataStore) => Promise<T>) {
  const execute = async () => {
    const snapshot = await store.exportAll()
    let state: Record<string, unknown> = JSON.parse(snapshot)
    const adapter: IStorageAdapter = {
      get: async <T,>(key: string) => structuredClone(state[key] ?? null) as T | null,
      set: async (key, value) => { state[key] = structuredClone(value) },
      remove: async key => { delete state[key] }, clear: async () => { state = {} }, keys: async () => Object.keys(state),
      export: async () => JSON.stringify(state), import: async json => { state = JSON.parse(json) }, getUsage: async () => 0,
    }
    const staged = createDataStore({ adapter })
    const result = await apply(staged)
    try { await store.importAll(await staged.exportAll()) }
    catch (error) { await store.importAll(snapshot); throw error }
    for (const repository of Object.values(store)) {
      if (repository && typeof repository === "object" && "invalidateCache" in repository && typeof repository.invalidateCache === "function") repository.invalidateCache()
    }
    return result
  }
  const next = queue.then(() => typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("erp-demo-booking", execute) : execute())
  queue = next.catch(() => {})
  return next
}

