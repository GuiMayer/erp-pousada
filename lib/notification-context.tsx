"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react"
import type { Notification, NotificationPreferences, NotificationType, NotificationPriority } from "./types/notifications"
import { DEFAULT_NOTIFICATION_PREFERENCES } from "./types/notifications"

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  preferences: NotificationPreferences
  sendNotification: (
    type: NotificationType,
    title: string,
    message: string,
    priority?: NotificationPriority,
    reference?: string
  ) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotification: (id: string) => void
  clearAllNotifications: () => void
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

const STORAGE_KEY = "pousada_notifications"
const PREFERENCES_KEY = "pousada_notification_preferences"
const MAX_NOTIFICATIONS = 50
const AUTO_CLEAR_DAYS = 7

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedNotifications = localStorage.getItem(STORAGE_KEY)
      const savedPreferences = localStorage.getItem(PREFERENCES_KEY)

      if (savedNotifications) {
        const parsed = JSON.parse(savedNotifications) as Notification[]
        // Convert timestamp strings back to Date objects
        const withDates = parsed.map(n => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }))
        
        // Filter out old notifications
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - AUTO_CLEAR_DAYS)
        const filtered = withDates.filter(n => n.timestamp > cutoffDate)
        
        setNotifications(filtered)
      }

      if (savedPreferences) {
        setPreferences(JSON.parse(savedPreferences))
      }
    } catch (error) {
      console.error("Error loading notifications:", error)
    }
  }, [])

  // Save to localStorage whenever notifications change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
    } catch (error) {
      console.error("Error saving notifications:", error)
    }
  }, [notifications])

  // Save preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
    } catch (error) {
      console.error("Error saving preferences:", error)
    }
  }, [preferences])

  const unreadCount = notifications.filter(n => !n.read).length

  const shouldSendNotification = useCallback((type: NotificationType): boolean => {
    if (!preferences.enabled) return false

    switch (type) {
      case 'check-in':
      case 'check-out':
        return preferences.checkInOut
      case 'payment':
        return preferences.payments
      case 'reservation':
        return preferences.reservations
      case 'cleaning':
        return preferences.cleaning
      case 'pos':
      case 'restaurant':
        return preferences.posRestaurant
      default:
        return true
    }
  }, [preferences])

  const sendNotification = useCallback((
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    reference?: string
  ) => {
    if (!shouldSendNotification(type)) return

    const newNotification: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      priority,
      timestamp: new Date(),
      read: false,
      reference,
    }

    setNotifications(prev => {
      const updated = [newNotification, ...prev]
      // Keep only the most recent MAX_NOTIFICATIONS
      return updated.slice(0, MAX_NOTIFICATIONS)
    })

    // Browser notification if enabled
    if (preferences.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/icon.svg',
        tag: newNotification.id,
      })
    }
  }, [shouldSendNotification, preferences.browserNotifications])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    )
  }, [])

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const updatePreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    setPreferences(prev => ({ ...prev, ...prefs }))

    // Request browser notification permission if enabled
    if (prefs.browserNotifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const contextValue = useMemo(
    () => ({
      notifications,
      unreadCount,
      preferences,
      sendNotification,
      markAsRead,
      markAllAsRead,
      clearNotification,
      clearAllNotifications,
      updatePreferences,
    }),
    [
      notifications,
      unreadCount,
      preferences,
      sendNotification,
      markAsRead,
      markAllAsRead,
      clearNotification,
      clearAllNotifications,
      updatePreferences,
    ]
  )

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider")
  }
  return context
}
