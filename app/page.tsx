"use client"

import { ConflictReview } from "@/components/conflict-review"
import { OperationApproval } from "@/components/operation-approval"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { AppProvider } from "@/lib/app-context"
import { AlertProvider } from "@/lib/alert-context"
import { NotificationProvider } from "@/lib/notification-context"
import { UserPreferencesProvider } from "@/contexts/user-preferences-context"
import { ActiveTabProvider } from "@/contexts/active-tab-context"
import { TaskDraftProvider } from "@/contexts/task-drafts-context"
import { ThemeProvider } from "@/components/theme-provider"
import { LoginScreen } from "@/components/login-screen"
import { DashboardShell } from "@/components/dashboard-shell"
import { DynamicTitle } from "@/components/dynamic-title"
import { Toaster } from "@/components/ui/toaster"

function AppContent() {
  const { isLoggedIn, user } = useAuth()

  if (!isLoggedIn) return <LoginScreen />

  return (
    <TaskDraftProvider key={`${user?.id}:${user?.accessVersion}`}><ActiveTabProvider>
      <NotificationProvider>
        <AlertProvider>
          <DynamicTitle />
          <main className="min-h-screen bg-background">
            <DashboardShell />
          </main>
          <OperationApproval />
          <ConflictReview />
          <Toaster />
        </AlertProvider>
      </NotificationProvider>
    </ActiveTabProvider></TaskDraftProvider>
  )
}

export default function Page() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <UserPreferencesProvider>
        <AuthProvider>
          <AppProvider>
            <AppContent />
          </AppProvider>
        </AuthProvider>
      </UserPreferencesProvider>
    </ThemeProvider>
  )
}
