import { describe, it, expect, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { AppProvider, useApp } from "@/lib/app-context"

vi.unmock("@/lib/hooks/useDataStore")

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider><AppProvider>{children}</AppProvider></AuthProvider>
const response = (data: unknown) => ({ ok: true, json: async () => data })
const secret = { id: "private-expense", description: "Despesa restrita", value: 40, paid: false, dueDate: "2030-01-01", category: "Exemplo" }

describe("Dados e mudanças de identidade", () => {
  it("logout de outra aba elimina os dados já carregados", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    let active = true
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/auth/session") return active ? response({ user: { id: "admin", username: "admin", role: "supervisor", permissions: ["expenses.read"] } }) : { ok: false, status: 401 }
      return response(url.endsWith("/expenses") ? [secret] : [])
    }))
    const { result } = renderHook(() => ({ auth: useAuth(), app: useApp() }), { wrapper })
    await waitFor(() => expect(result.current.app.expenses).toHaveLength(1))
    active = false
    await act(async () => { window.dispatchEvent(new StorageEvent("storage", { key: "erp_auth_changed", newValue: "logout" })) })
    await waitFor(() => expect(result.current.auth.isLoggedIn).toBe(false))
    expect(result.current.app.expenses).toEqual([])
  })
  it("resposta de dados atrasada não transfere informações para outro usuário", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    let user = { id: "admin", username: "admin", role: "supervisor", permissions: ["expenses.read"], accessVersion: 0 }
    let expenseReads = 0
    let finish: (value: unknown) => void = () => {}
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/session") return Promise.resolve(response({ user }))
      if (url.endsWith("/expenses")) {
        expenseReads++
        if (expenseReads > 1) return new Promise(resolve => { finish = resolve })
        return Promise.resolve(response([secret]))
      }
      return Promise.resolve(response([]))
    }))
    const { result } = renderHook(() => ({ auth: useAuth(), app: useApp() }), { wrapper })
    await waitFor(() => expect(result.current.app.expenses).toHaveLength(1))
    user = { id: "reception", username: "reception", role: "operador", permissions: ["rooms.read"], accessVersion: 0 }
    await act(async () => { window.dispatchEvent(new Event("focus")) })
    await waitFor(() => expect(result.current.auth.username).toBe("reception"))
    await act(async () => { finish(response([secret])) })
    expect(result.current.app.expenses).toEqual([])
    expect(result.current.auth.can("expenses.read")).toBe(false)
  })
})
