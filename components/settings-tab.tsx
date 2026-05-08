"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Settings, Moon, Bell } from "lucide-react"

type UserPreferences = {
  darkMode: boolean
  notifications: boolean
}

const DEFAULT_PREFERENCES: UserPreferences = {
  darkMode: false,
  notifications: true,
}

export function SettingsTab() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("user_preferences")
      if (saved) {
        const parsed = JSON.parse(saved) as UserPreferences
        setPreferences(parsed)
      }
    } catch (error) {
      console.error("Error loading preferences:", error)
    }
  }, [])

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("user_preferences", JSON.stringify(preferences))
    } catch (error) {
      console.error("Error saving preferences:", error)
    }
  }, [preferences])

  const handleDarkModeChange = (checked: boolean) => {
    setPreferences(prev => ({ ...prev, darkMode: checked }))
  }

  const handleNotificationsChange = (checked: boolean) => {
    setPreferences(prev => ({ ...prev, notifications: checked }))
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">
          Configurações
        </h2>
      </div>

      {/* Aparência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="size-4" />
            Aparência
          </CardTitle>
          <CardDescription>
            Personalize a interface do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="dark-mode">Modo Noturno</Label>
              <p className="text-sm text-muted-foreground">
                Ativar tema escuro (em breve)
              </p>
            </div>
            <Switch
              id="dark-mode"
              checked={preferences.darkMode}
              onCheckedChange={handleDarkModeChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4" />
            Notificações
          </CardTitle>
          <CardDescription>
            Configure alertas e avisos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">Notificações do Sistema</Label>
              <p className="text-sm text-muted-foreground">
                Receber alertas de eventos importantes (em breve)
              </p>
            </div>
            <Switch
              id="notifications"
              checked={preferences.notifications}
              onCheckedChange={handleNotificationsChange}
            />
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Suas preferências são salvas automaticamente
      </p>
    </div>
  )
}
