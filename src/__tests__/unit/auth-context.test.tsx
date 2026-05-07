import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../../lib/auth-context'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('AuthContext', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('should start with logged out state', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    expect(result.current.isLoggedIn).toBe(false)
    expect(result.current.role).toBeNull()
    expect(result.current.username).toBeNull()
    expect(result.current.isSupervisor).toBe(false)
  })

  it('should login with valid operador credentials', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    act(() => {
      const success = result.current.login('operador', '1234')
      expect(success).toBe(true)
    })

    expect(result.current.isLoggedIn).toBe(true)
    expect(result.current.role).toBe('operador')
    expect(result.current.username).toBe('operador')
    expect(result.current.isSupervisor).toBe(false)
  })

  it('should login with valid supervisor credentials', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    act(() => {
      const success = result.current.login('supervisor', 'admin')
      expect(success).toBe(true)
    })

    expect(result.current.isLoggedIn).toBe(true)
    expect(result.current.role).toBe('supervisor')
    expect(result.current.username).toBe('supervisor')
    expect(result.current.isSupervisor).toBe(true)
  })

  it('should fail login with invalid credentials', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    act(() => {
      const success = result.current.login('operador', 'wrong-password')
      expect(success).toBe(false)
    })

    expect(result.current.isLoggedIn).toBe(false)
    expect(result.current.role).toBeNull()
  })

  it('should logout successfully', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    act(() => {
      result.current.login('operador', '1234')
    })

    expect(result.current.isLoggedIn).toBe(true)

    act(() => {
      result.current.logout()
    })

    expect(result.current.isLoggedIn).toBe(false)
    expect(result.current.role).toBeNull()
    expect(result.current.username).toBeNull()
  })

  it('should persist auth state to localStorage', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    act(() => {
      result.current.login('supervisor', 'admin')
    })

    const stored = localStorageMock.getItem('pousada_auth')
    expect(stored).toBeTruthy()
    
    const parsed = JSON.parse(stored!)
    expect(parsed.isLoggedIn).toBe(true)
    expect(parsed.role).toBe('supervisor')
    expect(parsed.username).toBe('supervisor')
  })

  it('should restore auth state from localStorage', () => {
    localStorageMock.setItem(
      'pousada_auth',
      JSON.stringify({
        isLoggedIn: true,
        role: 'operador',
        username: 'operador',
      })
    )

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    expect(result.current.isLoggedIn).toBe(true)
    expect(result.current.role).toBe('operador')
    expect(result.current.username).toBe('operador')
  })

  it('should clear localStorage on logout', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    act(() => {
      result.current.login('operador', '1234')
    })

    expect(localStorageMock.getItem('pousada_auth')).toBeTruthy()

    act(() => {
      result.current.logout()
    })

    expect(localStorageMock.getItem('pousada_auth')).toBeNull()
  })

  it('should handle case-insensitive username', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    act(() => {
      const success = result.current.login('OPERADOR', '1234')
      expect(success).toBe(true)
    })

    expect(result.current.username).toBe('operador')
  })
})
