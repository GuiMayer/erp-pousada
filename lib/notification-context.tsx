"use client"
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react"
import { useAuth } from "./auth-context"
import { getDataConfig } from "./data/config"
import type { Notification, NotificationPreferences, NotificationType, NotificationPriority } from "./types/notifications"
import { DEFAULT_NOTIFICATION_PREFERENCES } from "./types/notifications"
import { categoryEnabled } from "./notification-policy"
import { nativePermission, presentNative, requestNativePermission } from "./native-notifications"
type Cursor = { date: string; id: string } | null
interface NotificationContextType {
  notifications: Notification[]; unreadCount: number; preferences: NotificationPreferences
  loading: boolean; error: string | null; permission: ReturnType<typeof nativePermission>; hasMore: boolean; archived: boolean
  refresh: () => void; loadMore: () => void; showArchived: (value: boolean) => void
  sendNotification: (type: NotificationType, title: string, message: string, priority?: NotificationPriority, reference?: string) => void
  markAsRead: (id: string) => void; markAllAsRead: () => void; clearNotification: (id: string) => void; clearAllNotifications: () => void
  resolveNotification: (id: string) => void; restoreNotification: (id: string) => void; updatePreferences: (prefs: Partial<NotificationPreferences>) => void
}
const NotificationContext = createContext<NotificationContextType | undefined>(undefined)
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const demo = getDataConfig().adapter === "demo-localStorage"
  const key = `erp:demo:notifications:${user?.id ?? "anonymous"}`
  const prefKey = `${key}:preferences`
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(!demo)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState(nativePermission)
  const [archived, setArchived] = useState(false)
  const [cursor, setCursor] = useState<Cursor>(null)
  const [hydratedKey, setHydratedKey] = useState<string | null>(null)
  const epoch = useRef(0)
  const busy = useRef(false)
  const known = useRef<Set<string> | null>(null)
  const failures = useRef(0)
  const retryAfter = useRef(0)
  const scope = JSON.stringify([user?.id, user?.accessVersion, user?.permissions])
  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { cache: "no-store", ...init })
    if (response.status === 401) { window.dispatchEvent(new Event("erp:session-expired")); throw new Error("Sessão expirada") }
    if (!response.ok) throw new Error("Não foi possível atualizar as notificações")
    return response.json()
  }, [])
  const refresh = useCallback(async (more = false, force = true) => {
    if (demo || !user || busy.current || (!force && Date.now() < retryAfter.current)) return
    const current = epoch.current
    busy.current = true
    setLoading(true)
    try {
      const query = new URLSearchParams({ archived: String(archived) })
      if (more && cursor) { query.set("date", cursor.date); query.set("id", cursor.id) }
      const data = await request(`/api/notifications?${query}`)
      if (epoch.current !== current) return
      const critical: Notification[] = data.activeAlerts ?? []
      const incoming: Notification[] = more ? data.notifications : [...critical, ...data.notifications.filter((n: Notification) => !critical.some(c => c.id === n.id))]
      const rows: Notification[] = incoming.map((n: Notification) => ({ ...n, timestamp: new Date(n.timestamp) }))
      if (!more && !archived) {
        if (known.current && data.preferences.browserNotifications) for (const row of rows) if (!row.read && categoryEnabled(row.type, data.preferences) && !known.current.has(row.id)) presentNative(user.id, row.id)
        known.current = new Set(rows.map(n => n.id))
      }
      setNotifications(previous => more ? [...previous, ...rows.filter(n => !previous.some(p => p.id === n.id))] : rows)
      setUnreadCount(data.unreadCount); setPreferences(data.preferences); setCursor(data.nextCursor); setError(null)
      failures.current = 0; retryAfter.current = 0
    } catch (failure) {
      if (current === epoch.current) { setError((failure as Error).message); failures.current++; retryAfter.current = Date.now() + Math.min(120000, 15000 * 2 ** failures.current) }
    } finally { if (current === epoch.current) { busy.current = false; setLoading(false) } }
  }, [demo, user, request, archived, cursor])
  const refreshRef = useRef(refresh)
  useEffect(() => { refreshRef.current = refresh }, [refresh])
  useEffect(() => {
    epoch.current++; busy.current = false; known.current = null
    if (demo) {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "[]") as Notification[]
        setNotifications(saved.map(n => ({ ...n, timestamp: new Date(n.timestamp) })).filter(n => Number.isFinite(n.timestamp.getTime()) && n.timestamp.getTime() > Date.now() - 30 * 86400000))
        setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(localStorage.getItem(prefKey) || "{}") })
      } catch { setNotifications([]); setPreferences(DEFAULT_NOTIFICATION_PREFERENCES) }
      setHydratedKey(key)
    } else { void refreshRef.current() }
    const focused = () => { setPermission(nativePermission()); void refreshRef.current() }
    const periodic = () => { if (!document.hidden) void refreshRef.current(false, false) }
    const storage = (event: StorageEvent) => { if (event.key === `erp:notification-sync:${user?.id}`) focused() }
    const timer = setInterval(periodic, 15000)
    window.addEventListener("focus", focused); document.addEventListener("visibilitychange", focused)
    window.addEventListener("erp:operation-completed", focused); window.addEventListener("storage", storage)
    // This epoch is an async request generation, not a DOM ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { epoch.current++; clearInterval(timer); window.removeEventListener("focus", focused); document.removeEventListener("visibilitychange", focused); window.removeEventListener("erp:operation-completed", focused); window.removeEventListener("storage", storage) }
  }, [scope, demo, key, prefKey, user?.id, archived])
  useEffect(() => {
    if (!demo || hydratedKey !== key) return
    try { localStorage.setItem(key, JSON.stringify(notifications)); localStorage.setItem(prefKey, JSON.stringify(preferences)) } catch { /* Demo storage can be unavailable. */ }
    setUnreadCount(notifications.filter(n => !n.read && !n.archived && categoryEnabled(n.type, preferences)).length)
  }, [demo, hydratedKey, key, prefKey, notifications, preferences])
  const change = useCallback(async (ids: string[], action: "read" | "archive" | "restore" | "resolve") => {
    if (demo) { setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, ...(action === "read" ? { read: true } : { archived: action === "archive" }) } : n)); return }
    const current = epoch.current
    try {
      await request("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action }) })
      if (current !== epoch.current) return
      try { localStorage.setItem(`erp:notification-sync:${user?.id}`, crypto.randomUUID()) } catch { /* Sync will also happen through polling. */ }
      void refreshRef.current()
    } catch (failure) { if (current === epoch.current) setError((failure as Error).message) }
  }, [demo, request, user?.id])
  const updatePreferences = useCallback(async (patch: Partial<NotificationPreferences>) => {
    const current = epoch.current
    try {
      if (patch.browserNotifications) { const next = await requestNativePermission(); if (current !== epoch.current) return; setPermission(next) }
      if (demo) setPreferences(prev => ({ ...prev, ...patch }))
      else { const next = await request("/api/notification-preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); if (current === epoch.current) { setPreferences(next); void refreshRef.current() } }
    } catch (failure) { if (current === epoch.current) setError((failure as Error).message) }
  }, [demo, request])
  const sendNotification = useCallback((type: NotificationType, title: string, message: string, priority: NotificationPriority = "medium", reference?: string) => {
    if (!demo) { void refreshRef.current(); return }
    if (!categoryEnabled(type, preferences)) return
    const notification: Notification = { id: crypto.randomUUID(), type, title, message, priority, reference, timestamp: new Date(), read: false }
    setNotifications(prev => [notification, ...prev].slice(0, 200))
    if (preferences.browserNotifications && user) presentNative(user.id, notification.id)
  }, [demo, preferences, user])
  const visible = useMemo(() => demo ? notifications.filter(n => !!n.archived === archived && categoryEnabled(n.type, preferences)) : notifications, [demo, notifications, archived, preferences])
  const value: NotificationContextType = { notifications: visible, preferences, unreadCount, loading, error, permission, archived, hasMore: !!cursor,
    refresh: () => { void refreshRef.current() }, loadMore: () => { void refresh(true) }, showArchived: value => { if (value !== archived) { setArchived(value); setCursor(null); setNotifications([]) } else void refreshRef.current() },
    sendNotification, markAsRead: id => { void change([id], "read") }, markAllAsRead: () => { void change(visible.map(n => n.id), "read") },
    clearNotification: id => { void change([id], "archive") }, clearAllNotifications: () => { void change(visible.map(n => n.id), "archive") },
    resolveNotification: id => { void change([id], "resolve") }, restoreNotification: id => { void change([id], "restore") }, updatePreferences }
  useEffect(() => { if (!demo) void refreshRef.current() }, [archived, demo])
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}
export function useNotifications() { const context = useContext(NotificationContext); if (!context) throw new Error("useNotifications must be used within NotificationProvider"); return context }
