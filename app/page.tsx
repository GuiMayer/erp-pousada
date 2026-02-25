"use client"

import { AuthProvider, useAuth } from "@/lib/auth-context"
import { AppProvider } from "@/lib/app-context"
import { LoginScreen } from "@/components/login-screen"
import { DashboardShell } from "@/components/dashboard-shell"

function AppContent() {
  const { isLoggedIn } = useAuth()

  if (!isLoggedIn) return <LoginScreen />

  return (
    <AppProvider>
      <main className="min-h-screen bg-background">
        <DashboardShell />
      </main>
    </AppProvider>
  )
}

export default function Page() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
