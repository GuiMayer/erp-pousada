"use client"

import { useState } from "react"
import { useNotifications } from "@/lib/notification-context"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Bell, 
  BellOff, 
  Check, 
  CheckCheck, 
  Trash2, 
  Calendar,
  DollarSign,
  Bed,
  Sparkles,
  ShoppingCart,
  UtensilsCrossed,
  X
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { NotificationType } from "@/lib/types/notifications"

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  'check-in': <Bed className="size-4" />,
  'check-out': <Bed className="size-4" />,
  'payment': <DollarSign className="size-4" />,
  'cleaning': <Sparkles className="size-4" />,
  'reservation': <Calendar className="size-4" />,
  'pos': <ShoppingCart className="size-4" />,
  'restaurant': <UtensilsCrossed className="size-4" />,
}

const priorityColors = {
  low: "text-muted-foreground",
  medium: "text-blue-600 dark:text-blue-400",
  high: "text-destructive",
}

export function NotificationCenter() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearNotification,
    clearAllNotifications 
  } = useNotifications()
  
  const [open, setOpen] = useState(false)

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    markAsRead(id)
  }

  const handleClearNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    clearNotification(id)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <Bell className="size-5" />
          ) : (
            <BellOff className="size-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 size-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-6 px-2 text-xs"
                >
                  <CheckCheck className="size-3 mr-1" />
                  Marcar todas
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllNotifications}
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3 mr-1" />
                Limpar
              </Button>
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BellOff className="size-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma notificação
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex flex-col items-start gap-2 p-3 cursor-pointer ${
                  !notification.read ? 'bg-accent/50' : ''
                }`}
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                <div className="flex items-start justify-between w-full gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className={`mt-0.5 ${priorityColors[notification.priority]}`}>
                      {notificationIcons[notification.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="size-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(notification.timestamp, {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                      >
                        <Check className="size-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-destructive hover:text-destructive"
                      onClick={(e) => handleClearNotification(notification.id, e)}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
