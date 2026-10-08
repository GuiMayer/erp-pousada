"use client"
import { useEffect, useRef, useState } from "react"
import { Map, CalendarDays, ShoppingCart, UtensilsCrossed, Package, DollarSign, BarChart3, Settings, Shield, History, Menu, UserRound } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useApp } from "@/lib/app-context"
import { useActiveTab } from "@/contexts/active-tab-context"
import { tabPermissions } from "@/lib/permissions"
import { NotificationCenter } from "./notification-center"
import { Button } from "./ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from "./ui/dropdown-menu"

export const mobileModules = [
  { key: "mapa", label: "Mapa", icon: Map, group: "Operação" },
  { key: "reservas", label: "Reservas", icon: CalendarDays, group: "Operação" },
  { key: "pdv", label: "Caixa", icon: ShoppingCart, group: "Operação" },
  { key: "restaurante", label: "Restaurante", icon: UtensilsCrossed, group: "Operação" },
  { key: "estoque", label: "Estoque", icon: Package, group: "Operação" },
  { key: "financeiro", label: "Financeiro", icon: DollarSign, group: "Gestão" },
  { key: "relatorios", label: "Relatórios", icon: BarChart3, group: "Gestão" },
  { key: "configuracoes", label: "Configurações", icon: Settings, group: "Administração" },
  { key: "administracao", label: "Administração", icon: Shield, group: "Administração" },
  { key: "auditoria", label: "Auditoria", icon: History, group: "Administração" },
] as const
export function phoneDestinations(can: (permission: string) => boolean) {
  return mobileModules.filter(module => tabPermissions[module.key]?.some(can))
}
export function MobileNavigation() {
  const { can, username, logout } = useAuth()
  const { systemSettings } = useApp()
  const { activeTab, setActiveTab } = useActiveTab()
  const [open, setOpen] = useState(false)
  const destinations = phoneDestinations(can)
  const shortcuts = destinations.slice(0, 4)
  const positions = useRef<Record<string, number>>({})
  const previous = useRef(activeTab)
  useEffect(() => {
    if (previous.current === activeTab) return
    previous.current = activeTab
    const frame = requestAnimationFrame(() => window.scrollTo(0, positions.current[activeTab] ?? 0))
    return () => cancelAnimationFrame(frame)
  }, [activeTab])
  function navigate(key: typeof activeTab) {
    positions.current[activeTab] = window.scrollY
    setActiveTab(key); setOpen(false)
  }
  return <>
    <header className="mobile-app-header sm:hidden">
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{mobileModules.find(module => module.key === activeTab)?.label ?? "Pousada"}</h1>
      <NotificationCenter />
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Minha conta"><UserRound className="size-5" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end"><DropdownMenuLabel className="max-w-64 break-words">{systemSettings.pousadaName}<br />{username}</DropdownMenuLabel><DropdownMenuItem onSelect={logout}>Sair da conta</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>
    </header>
    <nav aria-label="Navegação principal mobile" className="mobile-bottom-nav sm:hidden">
      {shortcuts.map(module => <button key={module.key} onClick={() => navigate(module.key)} aria-current={activeTab === module.key ? "page" : undefined}><module.icon aria-hidden className="size-5" /><span>{module.label}</span></button>)}
      <button onClick={() => setOpen(true)} aria-label="Mais módulos" aria-current={!shortcuts.some(module => module.key === activeTab) ? "page" : undefined}><Menu aria-hidden className="size-5" /><span>Mais</span></button>
    </nav>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent className="sm:hidden"><SheetHeader><SheetTitle>Módulos</SheetTitle><SheetDescription>Escolha uma área do sistema.</SheetDescription></SheetHeader>
      <div className="space-y-5 p-4">{["Operação", "Gestão", "Administração"].map(group => {
        const items = destinations.filter(module => module.group === group)
        return items.length ? <section key={group}><h2 className="mb-2 text-sm font-semibold text-muted-foreground">{group}</h2><div className="grid gap-1">{items.map(module => <Button key={module.key} variant={module.key === activeTab ? "secondary" : "ghost"} className="justify-start gap-3" onClick={() => navigate(module.key)}><module.icon className="size-5" />{module.label}</Button>)}</div></section> : null
      })}</div>
    </SheetContent></Sheet>
  </>
}
