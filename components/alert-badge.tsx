"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useAlerts } from "@/lib/alert-context"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

export function AlertBadge() {
  const { alerts, activeAlertsCount, criticalAlertsCount, dismissAlert, clearAlerts } = useAlerts()

  if (activeAlertsCount === 0) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Bell className="h-5 w-5" />
      </Button>
    )
  }

  const priorityColor = criticalAlertsCount > 0 ? "destructive" : "default"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge
            variant={priorityColor}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {activeAlertsCount}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Alertas</span>
          {activeAlertsCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAlerts}
              className="h-6 text-xs"
            >
              Limpar todos
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {alerts.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhum alerta ativo
          </div>
        ) : (
          alerts.map((alert) => (
            <DropdownMenuItem
              key={alert.id}
              className="flex flex-col items-start gap-1 p-3 cursor-pointer"
              onClick={() => dismissAlert(alert.id)}
            >
              <div className="flex items-start justify-between w-full gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        alert.type === 'error' || alert.type === 'warning'
                          ? 'destructive'
                          : 'default'
                      }
                      className={cn(
                        "text-xs",
                        alert.priority === 'critical' && "animate-pulse"
                      )}
                    >
                      {alert.priority === 'critical' ? '🔴' : 
                       alert.priority === 'high' ? '🟠' :
                       alert.priority === 'medium' ? '🟡' : '🔵'}
                    </Badge>
                    <span className="font-semibold text-sm">{alert.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {alert.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(alert.timestamp), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
