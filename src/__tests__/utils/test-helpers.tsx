/**
 * Test Helpers
 * 
 * Shared utilities for testing with AuthProvider and AppProvider
 */

import { ReactNode } from 'react'
import { AuthProvider } from '../../../lib/auth-context'
import { AppProvider } from '../../../lib/app-context'

/**
 * Test wrapper that provides both AuthProvider and AppProvider
 * Use this for tests that need access to both contexts
 */
export function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppProvider>{children}</AppProvider>
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
