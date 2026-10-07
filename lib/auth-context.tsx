"use client"

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react"
import type { UserRole } from "./store"
import { getDataConfig } from "./data/config"

type AuthUser = { id: string; username: string; role: UserRole }
type AuthContextType = {
  user: AuthUser | null
  isLoggedIn: boolean
  isLoading: boolean
  role: UserRole | null
  username: string | null
  isSupervisor: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthContextType | null>(null)
const DEMO_KEY = "erp_demo_auth"
const demoUsers = {
  operador: { password: "1234", role: "operador" },
  supervisor: { password: "adm123", role: "supervisor" },
} as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setLoading] = useState(true)
  const demo = getDataConfig().adapter === "demo-localStorage"
  useEffect(() => {
    let cancelled = false
    async function restore() {
      try {
        if (demo) {
          const saved = JSON.parse(localStorage.getItem(DEMO_KEY) || "null") as AuthUser | null
          if (!cancelled && saved && (saved.role === "operador" || saved.role === "supervisor")) setUser(saved)
        } else {
          const response = await fetch("/api/auth/session", { cache: "no-store" })
          if (response.ok && !cancelled) setUser((await response.json()).user)
        }
      } catch { if (!cancelled) setUser(null) }
      finally { if (!cancelled) setLoading(false) }
    }
    void restore()
    return () => { cancelled = true }
  }, [demo])

  useEffect(() => {
    const expired = () => setUser(null)
    window.addEventListener("erp:session-expired", expired)
    return () => window.removeEventListener("erp:session-expired", expired)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const normalized = username.trim().toLowerCase()
    if (demo) {
      const account = demoUsers[normalized as keyof typeof demoUsers]
      if (!account || account.password !== password) return false
      const next = { id: `demo-${normalized}`, username: normalized, role: account.role }
      setUser(next)
      localStorage.setItem(DEMO_KEY, JSON.stringify(next))
      return true
    }
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: normalized, password }) })
    if (!response.ok) {
      if (response.status === 401) return false
      throw new Error((await response.json()).error || "Não foi possível entrar")
    }
    setUser((await response.json()).user)
    return true
  }, [demo])

  const logout = useCallback(async () => {
    if (demo) localStorage.removeItem(DEMO_KEY)
    else {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok && response.status !== 401) throw new Error("Não foi possível encerrar a sessão")
    }
    setUser(null)
  }, [demo])

  const value = useMemo(() => ({ user, isLoggedIn: !!user, isLoading, role: user?.role ?? null, username: user?.username ?? null, isSupervisor: user?.role === "supervisor", login, logout }), [user, isLoading, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
