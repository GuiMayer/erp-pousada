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
})
