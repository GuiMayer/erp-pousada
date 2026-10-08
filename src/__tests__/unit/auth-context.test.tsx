import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { AuthProvider, useAuth } from "@/lib/auth-context"

describe("AuthContext", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals() })
  it("permite credenciais de exemplo somente no modo demo", async () => {
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { expect(await result.current.login("supervisor", "adm123")).toBe(true) })
    expect(result.current.isSupervisor).toBe(true)
    expect(localStorage.getItem("erp_demo_auth")).toBeTruthy()
    await act(async () => { await result.current.logout() })
    expect(result.current.isLoggedIn).toBe(false)
    expect(localStorage.getItem("erp_demo_auth")).toBeNull()
  })
  it("recusa credenciais erradas no demo", async () => {
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await act(async () => { expect(await result.current.login("operador", "errada")).toBe(false) })
    expect(result.current.isLoggedIn).toBe(false)
  })
  it("ignora perfil de supervisor forjado no localStorage em produção", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    localStorage.setItem("pousada_auth", JSON.stringify({ role: "supervisor", isLoggedIn: true }))
    localStorage.setItem("erp_demo_auth", JSON.stringify({ id: "fake", username: "supervisor", role: "supervisor" }))
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    vi.stubGlobal("fetch", fetchMock)
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isLoggedIn).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", { cache: "no-store" })
  })
  it("restaura sessão validada pelo servidor e aguarda logout", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    const user = { id: "real", username: "ana", role: "operador" }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user }) })
    vi.stubGlobal("fetch", fetchMock)
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.username).toBe("ana"))
    expect(result.current.isSupervisor).toBe(false)
    await act(async () => { await result.current.logout() })
    expect(result.current.isLoggedIn).toBe(false)
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/logout", { method: "POST" })
  })
  it("atualiza usuário e permissões ao voltar para a aba", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    let user = { id: "admin", username: "admin", role: "supervisor", permissions: ["users.manage"], accessVersion: 0 }
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ({ ok: true, json: async () => ({ user }) })))
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.can("users.manage")).toBe(true))
    user = { id: "caixa", username: "caixa", role: "operador", permissions: ["pos.sell"], accessVersion: 1 }
    await act(async () => { window.dispatchEvent(new Event("focus")) })
    await waitFor(() => expect(result.current.username).toBe("caixa"))
    expect(result.current.can("users.manage")).toBe(false)
    expect(result.current.can("pos.sell")).toBe(true)
  })
  it("mudança de acesso da mesma pessoa invalida as permissões anteriores", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    let user = { id: "real", username: "ana", role: "operador", permissions: ["expenses.read"], accessVersion: 0 }
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ({ ok: true, json: async () => ({ user }) })))
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.can("expenses.read")).toBe(true))
    user = { ...user, permissions: ["rooms.read"], accessVersion: 1 }
    await act(async () => { window.dispatchEvent(new Event("erp:permissions-changed")) })
    await waitFor(() => expect(result.current.can("rooms.read")).toBe(true))
    expect(result.current.can("expenses.read")).toBe(false)
  })
  it("logout de outra aba remove identidade e permissões", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { id: "real", username: "ana", role: "supervisor", permissions: ["users.manage"] } }) })
    vi.stubGlobal("fetch", fetchMock)
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true))
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    await act(async () => { window.dispatchEvent(new StorageEvent("storage", { key: "erp_auth_changed", newValue: "logout" })) })
    await waitFor(() => expect(result.current.isLoggedIn).toBe(false))
    expect(result.current.can("users.manage")).toBe(false)
  })
  it("uma leitura de sessão atrasada não desfaz o logout", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    let finish: (response: unknown) => void = () => {}
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { id: "real", username: "ana", role: "operador", permissions: [] } }) })
    vi.stubGlobal("fetch", fetchMock)
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true))
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await act(async () => { window.dispatchEvent(new Event("focus")) })
    await act(async () => { await result.current.logout() })
    await act(async () => { finish({ ok: true, json: async () => ({ user: { id: "real", username: "ana", role: "operador" } }) }) })
    expect(result.current.isLoggedIn).toBe(false)
  })
  it("role de supervisor não substitui a lista autorizada pelo servidor", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { id: "real", username: "ana", role: "supervisor", permissions: [] } }) }))
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.can("users.manage")).toBe(false)
  })
})
