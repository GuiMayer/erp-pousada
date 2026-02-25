"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { UserRole } from "./store"

type AuthState = {
  isLoggedIn: boolean
  role: UserRole | null
  username: string | null
}

type AuthContextType = AuthState & {
  login: (username: string, password: string) => boolean
  logout: () => void
  isSupervisor: boolean
}

const MOCK_USERS: Record<string, { password: string; role: UserRole }> = {
  operador: { password: "1234", role: "operador" },
  supervisor: { password: "admin", role: "supervisor" },
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: false,
    role: null,
    username: null,
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pousada_auth")
      if (saved) {
        const parsed = JSON.parse(saved) as AuthState
        if (parsed.isLoggedIn) setState(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  const login = useCallback((username: string, password: string) => {
    const user = MOCK_USERS[username.toLowerCase()]
    if (user && user.password === password) {
      const newState: AuthState = {
        isLoggedIn: true,
        role: user.role,
        username: username.toLowerCase(),
      }
      setState(newState)
      localStorage.setItem("pousada_auth", JSON.stringify(newState))
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    setState({ isLoggedIn: false, role: null, username: null })
    localStorage.removeItem("pousada_auth")
  }, [])

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        isSupervisor: state.role === "supervisor",
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
