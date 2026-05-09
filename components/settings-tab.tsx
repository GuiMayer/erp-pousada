"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { useNotifications } from "@/lib/notification-context"
import { useUserPreferences } from "@/contexts/user-preferences-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Settings, Moon, Sun, Monitor, Bell, BellOff, BarChart3 } from "lucide-react"

export function SettingsTab() {
  const { theme, setTheme } = useTheme()
  const { preferences: notificationPrefs, updatePreferences } = useNotifications()
  const { preferences: userPrefs, updatePreference } = useUserPreferences()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
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
          <div className="space-y-2">
            <Label htmlFor="theme-select">Tema</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger id="theme-select">
                <SelectValue placeholder="Selecione o tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="size-4" />
                    <span>Claro</span>
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="size-4" />
                    <span>Escuro</span>
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="size-4" />
                    <span>Sistema</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Escolha entre tema claro, escuro ou seguir as preferências do sistema
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos e Visualizações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-4" />
            Gráficos e Visualizações
          </CardTitle>
          <CardDescription>
            Configure o comportamento dos gráficos e relatórios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="chart-animations">Animações dos Gráficos</Label>
              <p className="text-sm text-muted-foreground">
                Ativar/desativar animações ao carregar gráficos
              </p>
            </div>
            <Switch
              id="chart-animations"
              checked={userPrefs.enableChartAnimations}
              onCheckedChange={(checked) => updatePreference('enableChartAnimations', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {notificationPrefs.enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            Notificações
          </CardTitle>
          <CardDescription>
            Configure alertas e avisos do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications-enabled">Notificações do Sistema</Label>
              <p className="text-sm text-muted-foreground">
                Ativar/desativar todas as notificações
              </p>
            </div>
            <Switch
              id="notifications-enabled"
              checked={notificationPrefs.enabled}
              onCheckedChange={(checked) => updatePreferences({ enabled: checked })}
            />
          </div>

          {notificationPrefs.enabled && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <p className="text-sm font-medium">Tipos de Notificações</p>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notif-checkinout">Check-in e Check-out</Label>
                    <p className="text-xs text-muted-foreground">
                      Alertas de entrada e saída de hóspedes
                    </p>
                  </div>
                  <Switch
                    id="notif-checkinout"
                    checked={notificationPrefs.checkInOut}
                    onCheckedChange={(checked) => updatePreferences({ checkInOut: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notif-payments">Pagamentos</Label>
                    <p className="text-xs text-muted-foreground">
                      Alertas de pagamentos recebidos
                    </p>
                  </div>
                  <Switch
                    id="notif-payments"
                    checked={notificationPrefs.payments}
                    onCheckedChange={(checked) => updatePreferences({ payments: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notif-reservations">Reservas</Label>
                    <p className="text-xs text-muted-foreground">
                      Alertas de novas reservas
                    </p>
                  </div>
                  <Switch
                    id="notif-reservations"
                    checked={notificationPrefs.reservations}
                    onCheckedChange={(checked) => updatePreferences({ reservations: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notif-cleaning">Limpeza</Label>
                    <p className="text-xs text-muted-foreground">
                      Alertas de status de limpeza
                    </p>
                  </div>
                  <Switch
                    id="notif-cleaning"
                    checked={notificationPrefs.cleaning}
                    onCheckedChange={(checked) => updatePreferences({ cleaning: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notif-pos">PDV e Restaurante</Label>
                    <p className="text-xs text-muted-foreground">
                      Alertas de vendas e pedidos
                    </p>
                  </div>
                  <Switch
                    id="notif-pos"
                    checked={notificationPrefs.posRestaurant}
                    onCheckedChange={(checked) => updatePreferences({ posRestaurant: checked })}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="browser-notifications">Notificações do Navegador</Label>
                  <p className="text-xs text-muted-foreground">
                    Receber notificações mesmo com a aba em segundo plano
                  </p>
                </div>
                <Switch
                  id="browser-notifications"
                  checked={notificationPrefs.browserNotifications}
                  onCheckedChange={(checked) => updatePreferences({ browserNotifications: checked })}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Suas preferências são salvas automaticamente
      </p>
    </div>
  )
}
