export type NotificationType = 
  | 'check-in' 
  | 'check-out' 
  | 'payment' 
  | 'cleaning' 
  | 'reservation'
  | 'pos'
  | 'restaurant'
  | 'stock'
  | 'cash'
  | 'production'

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  priority: NotificationPriority
  timestamp: Date
  read: boolean
  resolvedAt?: string | null
  module?: string
  archived?: boolean
  reference?: string // ID da reserva, quarto, etc
}

export interface NotificationPreferences {
  enabled: boolean
  checkInOut: boolean
  payments: boolean
  reservations: boolean
  cleaning: boolean
  posRestaurant: boolean
  stock: boolean
  cash: boolean
  production: boolean
  browserNotifications: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  checkInOut: true,
  payments: true,
  reservations: true,
  cleaning: true,
  posRestaurant: true,
  stock: true,
  cash: true,
  production: true,
  browserNotifications: false,
}
