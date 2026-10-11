"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type SetStateAction, type Dispatch } from "react"

type DraftStore = { values: Map<string, unknown>; defaults: Map<string, string | undefined>; listeners: Map<string, Set<() => void>> }
const TaskDraftContext = createContext<DraftStore | null>(null)

export function TaskDraftProvider({ children }: { children: ReactNode }) {
  const [store] = useState<DraftStore>(() => ({ values: new Map(), defaults: new Map(), listeners: new Map() }))
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (![...store.values].some(([key, value]) => JSON.stringify(value) !== store.defaults.get(key))) return
      event.preventDefault(); event.returnValue = ""
    }
    window.addEventListener('beforeunload', preventLoss)
    return () => window.removeEventListener('beforeunload', preventLoss)
  }, [store])
  return <TaskDraftContext.Provider value={store}>{children}</TaskDraftContext.Provider>
}

/** In-memory, per authenticated session. No business write or browser persistence. */
export function useTaskState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const store = useContext(TaskDraftContext)
  const [local, setLocal] = useState(initial)
  const initialValue = useRef(local)
  const subscribe = useCallback((listener: () => void) => {
    if (!store) return () => {}
    if (!store.values.has(key)) { store.values.set(key, initialValue.current); store.defaults.set(key, JSON.stringify(initialValue.current)) }
    const listeners = store.listeners.get(key) ?? new Set<() => void>()
    store.listeners.set(key, listeners); listeners.add(listener)
    return () => { listeners.delete(listener); if (!listeners.size) store.listeners.delete(key) }
  }, [store, key])
  const snapshot = useCallback(() => store?.values.has(key) ? store.values.get(key) as T : initialValue.current, [store, key])
  const value = useSyncExternalStore(subscribe, snapshot, () => initialValue.current)
  const setValue = useCallback((action: SetStateAction<T>) => {
    if (!store) { setLocal(action); return }
    const current = store.values.has(key) ? store.values.get(key) as T : initialValue.current
    const next = typeof action === "function" ? (action as (value: T) => T)(current) : action
    store.values.set(key, next)
    store.listeners.get(key)?.forEach(listener => listener())
  }, [store, key])
  return [store ? value : local, setValue]
}

export function useTaskRef<T>(key: string, initial: T) {
  const [ref] = useTaskState(key, () => ({ current: initial }))
  return ref
}
