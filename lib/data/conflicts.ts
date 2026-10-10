export type Row = Record<string, unknown>
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message) }
}
const history = new Map<string, Row>()
const snapshotKey = (key: string, id: string | number, version: unknown) => JSON.stringify([key, String(id), version])
export function rememberRows(key: string, value: unknown) {
  if (!Array.isArray(value)) return
  for (const item of value) {
    const row = item as Row
    if (typeof row.recordVersion !== "number") continue
    history.set(snapshotKey(key, String(key === "guests" ? row.cpf : row.id), row.recordVersion), structuredClone(row))
  }
  while (history.size > 1500) history.delete(history.keys().next().value!)
}
export function changedFields(key: string, id: string | number, draft: Row): Row {
  const original = history.get(snapshotKey(key, id, draft.recordVersion))
  return Object.fromEntries(Object.entries(draft).filter(([field, value]) => field === "recordVersion" || !original || JSON.stringify(original[field]) !== JSON.stringify(value)))
}
export type ConflictChallenge = { key: string; draft: Row; current: Row; resolve: (reviewed: Row) => void; reject: (error: Error) => void }
export function reviewConflict(key: string, draft: Row, current: Row): Promise<Row> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") { reject(new ApiError("Registro alterado", 409, "STALE_VERSION")); return }
    window.dispatchEvent(new CustomEvent<ConflictChallenge>("erp:conflict", { detail: { key, draft, current, resolve, reject } }))
  })
}
export function clearSnapshots() { history.clear() }
