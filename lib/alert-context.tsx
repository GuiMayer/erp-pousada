"use client"

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react"
import type { Alert, AlertType, AlertPriority, AlertThresholds } from "./types/alerts"
import { DEFAULT_THRESHOLDS } from "./types/alerts"
import { useAuth } from "./auth-context"
import { getDataConfig } from "./data/config"
import { useApp } from "./app-context"
import { ruleSchema } from "./notification-policy"
import { useToast } from "@/hooks/use-toast"

interface AlertContextType {
  alerts: Alert[]
  thresholds: AlertThresholds
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'dismissed'>) => void
  dismissAlert: (id: string) => void
  clearAlerts: () => void
  updateThresholds: (thresholds: Partial<AlertThresholds>) => void
  activeAlertsCount: number
  criticalAlertsCount: number
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)


export function AlertProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { systemSettings: settings } = useApp()
  const demo = getDataConfig().adapter === "demo-localStorage"
  const THRESHOLDS_KEY = `erp:demo:alert-thresholds:${user?.id}`
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS)
  const { toast } = useToast()

  // Load thresholds from localStorage on mount
  useEffect(() => {
    if (!demo) {
      const result = ruleSchema.safeParse((settings as unknown as { notificationRules?: unknown }).notificationRules ?? {})
      if (result.success) setThresholds({ ...DEFAULT_THRESHOLDS, ...result.data })
      return
    }
    const stored = localStorage.getItem(THRESHOLDS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setThresholds({ ...DEFAULT_THRESHOLDS, ...parsed })
      } catch (error) {
        console.error("Failed to load alert thresholds:", error)
      }
    }
  }, [demo, THRESHOLDS_KEY, settings])

  // Save thresholds to localStorage when changed
  const updateThresholds = useCallback((newThresholds: Partial<AlertThresholds>) => {
    if (!demo) return
    setThresholds(prev => {
      const updated = { ...prev, ...newThresholds }
      localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [demo, THRESHOLDS_KEY])

  const addAlert = useCallback((alertData: Omit<Alert, 'id' | 'timestamp' | 'dismissed'>) => {
    const newAlert: Alert = {
      ...alertData,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      dismissed: false,
    }

    setAlerts(prev => {
      // Check for duplicate alerts (same title and message within last 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      const isDuplicate = prev.some(alert => 
        alert.title === newAlert.title &&
        alert.message === newAlert.message &&
        new Date(alert.timestamp).getTime() > fiveMinutesAgo &&
        !alert.dismissed
      )

      if (isDuplicate) {
        return prev
      }

      return [...prev, newAlert]
    })

    // Show toast notification
    const variant = alertData.type === 'error' || alertData.type === 'warning' 
      ? 'destructive' 
      : 'default'

    toast({
      title: alertData.title,
      description: alertData.message,
      variant,
      duration: alertData.priority === 'critical' ? undefined : 5000, // Critical alerts don't auto-dismiss
    })

    return newAlert.id
  }, [toast])

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, dismissed: true } : alert
    ))
  }, [])

  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  // Auto-dismiss low priority alerts after 1 hour
  useEffect(() => {
    const interval = setInterval(() => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000
      setAlerts(prev => prev.map(alert => {
        if (
          alert.priority === 'low' &&
          !alert.dismissed &&
          new Date(alert.timestamp).getTime() < oneHourAgo
        ) {
          return { ...alert, dismissed: true }
        }
        return alert
      }))
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [])

  const activeAlerts = alerts.filter(a => !a.dismissed)
  const activeAlertsCount = activeAlerts.length
  const criticalAlertsCount = activeAlerts.filter(a => a.priority === 'critical').length

  const contextValue = useMemo(
    () => ({
      alerts: activeAlerts,
      thresholds,
      addAlert,
      dismissAlert,
      clearAlerts,
      updateThresholds,
      activeAlertsCount,
      criticalAlertsCount,
    }),
    [
      activeAlerts,
      thresholds,
      addAlert,
      dismissAlert,
      clearAlerts,
      updateThresholds,
      activeAlertsCount,
      criticalAlertsCount,
    ]
  )

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
    </AlertContext.Provider>
  )
}

export function useAlerts() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error("useAlerts must be used within AlertProvider")
  }
  return context
}
