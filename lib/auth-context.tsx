"use client"
import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, Fragment, type ReactNode } from "react"
import type { UserRole } from "./store"
import { getDataConfig } from "./data/config"
import { effectivePermissions } from "./permissions"
type AuthUser = { id: string; username: string; role: UserRole; permissions?: string[]; accessProfile?: string | null; accessVersion?: number; approvablePermissions?: string[] }
type AuthContextType = { user: AuthUser | null; isLoggedIn: boolean; isLoading: boolean; role: UserRole | null; username: string | null; isSupervisor: boolean; can: (permission: string) => boolean; canRequest: (permission: string) => boolean; login: (username: string, password: string) => Promise<boolean>; logout: () => Promise<void> }
const AuthContext = createContext<AuthContextType | null>(null)
const DEMO_KEY = "erp_demo_auth"
const SYNC_KEY = "erp_auth_changed"
const demoUsers = { operador: { password: "1234", role: "operador" }, supervisor: { password: "adm123", role: "supervisor" } } as const
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setLoading] = useState(true)
  const generation = useRef(0)
  const demo = getDataConfig().adapter === "demo-localStorage"
  const refresh = useCallback(async () => {
    const current = ++generation.current
    try {
      let next: AuthUser | null = null
      if (demo) {
        const saved = JSON.parse(localStorage.getItem(DEMO_KEY) || "null")
        if (saved && ["operador", "supervisor"].includes(saved.role)) next = saved
      } else {
        const response = await fetch("/api/auth/session", { cache: "no-store" })
        if (response.ok) next = (await response.json()).user
      }
      if (current === generation.current) setUser(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    } catch { if (current === generation.current) setUser(null) }
    finally { if (current === generation.current) setLoading(false) }
  }, [demo])
  useEffect(() => {
    void refresh()
    const expired = () => { generation.current++; setUser(null) }
    const synchronize = () => { expired(); void refresh() }
    const storage = (event: StorageEvent) => { if ([SYNC_KEY, DEMO_KEY].includes(event.key || "")) synchronize() }
    const focused = () => { void refresh() }
    const timer = setInterval(() => { if (!document.hidden) void refresh() }, 15000)
    window.addEventListener("focus", focused)
    window.addEventListener("storage", storage)
    window.addEventListener("erp:session-expired", expired)
    window.addEventListener("erp:permissions-changed", synchronize)
    // Access epochs must be invalidated on unmount; this ref is not a DOM reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { generation.current++; clearInterval(timer); window.removeEventListener("focus", focused); window.removeEventListener("storage", storage); window.removeEventListener("erp:session-expired", expired); window.removeEventListener("erp:permissions-changed", synchronize) }
  }, [refresh])
  const login = useCallback(async (username: string, password: string) => {
    const normalized = username.trim().toLowerCase()
    if (demo) {
      const account = demoUsers[normalized as keyof typeof demoUsers]
      if (!account || account.password !== password) return false
      const next = { id: `demo-${normalized}`, username: normalized, role: account.role }
      generation.current++; setUser(next); localStorage.setItem(DEMO_KEY, JSON.stringify(next)); return true
    }
    generation.current++
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: normalized, password }) })
    if (!response.ok) { if (response.status === 401) return false; throw new Error((await response.json()).error || "Não foi possível entrar") }
    generation.current++; setUser((await response.json()).user); localStorage.setItem(SYNC_KEY, crypto.randomUUID()); return true
  }, [demo])
  const logout = useCallback(async () => {
    generation.current++
    if (demo) localStorage.removeItem(DEMO_KEY)
    else { const response = await fetch("/api/auth/logout", { method: "POST" }); if (!response.ok && response.status !== 401) throw new Error("Não foi possível encerrar a sessão") }
    generation.current++; setUser(null)
    if (!demo) localStorage.setItem(SYNC_KEY, crypto.randomUUID())
  }, [demo])
  // Production trusts only the server's list. Role fallback is exclusive to demo.
  const permissions = useMemo(() => user ? user.permissions ?? (demo ? effectivePermissions(user) : []) : [], [user, demo])
  const can = useCallback((permission: string) => permissions.includes(permission), [permissions])
  const canRequest = useCallback((permission: string) => can(permission) || !!user?.approvablePermissions?.includes(permission), [can, user])
  const identity = JSON.stringify([user?.id, user?.accessVersion, permissions])
  const value = useMemo(() => ({ user, isLoggedIn: !!user, isLoading, role: user?.role ?? null, username: user?.username ?? null, isSupervisor: user?.role === "supervisor", can, canRequest, login, logout }), [user, isLoading, can, canRequest, login, logout])
  return <AuthContext.Provider value={value}><Fragment key={identity}>{children}</Fragment></AuthContext.Provider>
}
export function useAuth() { const ctx = useContext(AuthContext); if (!ctx) throw new Error("useAuth must be used within AuthProvider"); return ctx }
