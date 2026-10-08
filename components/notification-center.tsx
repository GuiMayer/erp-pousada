"use client"
import { useState } from "react"
import { useNotifications } from "@/lib/notification-context"
import { useAlerts } from "@/lib/alert-context"
import { useAuth } from "@/lib/auth-context"
import { useActiveTab } from "@/contexts/active-tab-context"
import { tabPermissions } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Bell, Check, Archive, RotateCcw } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
export function NotificationCenter() {
  const { notifications, unreadCount, loading, error, refresh, hasMore, loadMore, archived, showArchived, markAsRead, markAllAsRead, clearNotification, restoreNotification, resolveNotification } = useNotifications()
  const { alerts, dismissAlert } = useAlerts()
  const { can } = useAuth()
  const { setActiveTab } = useActiveTab()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<"all" | "alerts">("all")
  const rows = notifications.filter(n => filter === "all" || ["critical", "high"].includes(n.priority))
  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Notificações: ${unreadCount} não lidas`} className="relative size-11">
      <Bell className="size-5" />{unreadCount > 0 && <span className="absolute top-0 right-0 rounded-full bg-destructive text-destructive-foreground text-xs px-1">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
      <div className="p-3 border-b flex items-center justify-between"><strong>Notificações</strong><Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>Atualizar</Button></div>
      <div className="flex flex-wrap gap-1 p-2 border-b">
        <Button size="sm" variant={filter === "all" && !archived ? "secondary" : "ghost"} onClick={() => { setFilter("all"); showArchived(false) }}>Todas</Button>
        <Button size="sm" variant={filter === "alerts" ? "secondary" : "ghost"} onClick={() => { setFilter("alerts"); showArchived(false) }}>Alertas</Button>
        <Button size="sm" variant={archived ? "secondary" : "ghost"} onClick={() => { setFilter("all"); showArchived(true) }}>Arquivadas</Button>
        {!archived && <Button size="sm" variant="ghost" onClick={markAllAsRead} disabled={!notifications.length}>Ler esta página</Button>}
      </div>
      <div role="status" className="text-xs px-3">{error ? <span className="text-destructive">{error}</span> : loading ? "Atualizando…" : ""}</div>
      <div className="max-h-[min(28rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain">
        {!archived && alerts.map(alert => <article key={alert.id} className="p-3 border-b text-sm"><strong>{alert.title}</strong><p className="text-muted-foreground">{alert.message}</p><Button size="sm" variant="ghost" onClick={() => dismissAlert(alert.id)}>Entendido</Button></article>)}
        {rows.length === 0 && !loading && <p className="p-6 text-sm text-muted-foreground text-center">Nenhuma notificação neste filtro.</p>}
        {rows.map(n => <article key={n.id} className={`p-3 border-b ${!n.read ? "bg-accent/50" : ""}`}>
          <div className="flex gap-2 justify-between"><strong className="text-sm break-words">{n.title}</strong><span className="text-xs shrink-0">{n.priority === "critical" && !n.resolvedAt ? "Crítico ativo" : n.resolvedAt ? "Resolvido" : !n.read ? "Nova" : ""}</span></div>
          <p className="text-sm text-muted-foreground break-words">{n.message}</p><p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(n.timestamp, { addSuffix: true, locale: ptBR })}</p>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {n.module && Object.hasOwn(tabPermissions, n.module) && tabPermissions[n.module].some(can) && <Button size="sm" variant="ghost" className="min-h-11" onClick={() => { markAsRead(n.id); setActiveTab(n.module as Parameters<typeof setActiveTab>[0]); setOpen(false) }}>Abrir módulo</Button>}
            {n.priority === "critical" && !n.resolvedAt && ["cash", "production"].includes(n.type) && can("approvals.issue") && <Button size="sm" variant="ghost" className="min-h-11" onClick={() => resolveNotification(n.id)}>Conferido: resolver</Button>}
            {!n.read && <Button size="icon" variant="ghost" className="size-11" aria-label={`Marcar ${n.title} como lida`} onClick={() => markAsRead(n.id)}><Check className="size-4" /></Button>}
            <Button size="icon" variant="ghost" className="size-11" disabled={!archived && n.priority === "critical" && !n.resolvedAt} aria-label={`${archived ? "Restaurar" : "Arquivar"} ${n.title}`} onClick={() => archived ? restoreNotification(n.id) : clearNotification(n.id)}>{archived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}</Button>
          </div>
        </article>)}
        {hasMore && <Button variant="ghost" className="w-full min-h-11" disabled={loading} onClick={loadMore}>Carregar anteriores</Button>}
      </div>
      <p className="p-2 text-xs text-muted-foreground">Alertas críticos ativos permanecem visíveis até a resolução da condição.</p>
    </DropdownMenuContent>
  </DropdownMenu>
}
