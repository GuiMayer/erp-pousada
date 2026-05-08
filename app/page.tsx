"use client"

import { AuthProvider, useAuth } from "@/lib/auth-context"
import { AppProvider } from "@/lib/app-context"
import { AlertProvider } from "@/lib/alert-context"
import { ThemeProvider } from "@/components/theme-provider"
import { LoginScreen } from "@/components/login-screen"
import { DashboardShell } from "@/components/dashboard-shell"
import { Toaster } from "@/components/ui/toaster"

function AppContent() {
  const { isLoggedIn } = useAuth()

  if (!isLoggedIn) return <LoginScreen />

  return (
    <AlertProvider>
      <AppProvider>
        <main className="min-h-screen bg-background">
          <DashboardShell />
        </main>
        <Toaster />
      </AppProvider>
    </AlertProvider>
  )
}

export default function Page() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}
