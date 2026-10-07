/**
 * Test Helpers
 *
 * Shared utilities for testing with AuthProvider and AppProvider
 */

import { ReactNode, useEffect } from 'react'
import { AuthProvider, useAuth } from '../../../lib/auth-context'
import { AppProvider } from '../../../lib/app-context'

function SignedIn({ children }: { children: ReactNode }) {
  const { login } = useAuth()
  useEffect(() => { void login("supervisor", "adm123") }, [login])
  return <AppProvider>{children}</AppProvider>
}
/**
 * Test wrapper that provides both AuthProvider and AppProvider
 * Use this for tests that need access to both contexts
 */
export function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SignedIn>{children}</SignedIn>
    </AuthProvider>
  )
}

/**
 * Test wrapper that provides only AuthProvider
 * Use this for tests that only need authentication
 */
export function AuthWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
