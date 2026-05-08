export type NotificationType = 
  | 'check-in' 
  | 'check-out' 
  | 'payment' 
  | 'cleaning' 
  | 'reservation'
  | 'pos'
  | 'restaurant'

export type NotificationPriority = 'low' | 'medium' | 'high'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  priority: NotificationPriority
  timestamp: Date
  read: boolean
  reference?: string // ID da reserva, quarto, etc
}

export interface NotificationPreferences {
  enabled: boolean
  checkInOut: boolean
  payments: boolean
  reservations: boolean
  cleaning: boolean
  posRestaurant: boolean
  browserNotifications: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  checkInOut: true,
  payments: true,
  reservations: true,
  cleaning: true,
  posRestaurant: true,
  browserNotifications: false,
}
