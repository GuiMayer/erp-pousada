"use client"
import { RegistrationsTab } from "./registrations-tab"
import { MobileNavigation } from "./mobile-navigation"
import { usePhoneLayout } from "@/hooks/use-phone-layout"
import { useEffect, useState } from "react"
import { tabPermissions, canAccessTab } from "@/lib/permissions"

import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useActiveTab } from "@/contexts/active-tab-context"
import { DashboardHeader } from "./dashboard-header"
import { RoomSummary } from "./room-summary"
import { RoomGrid } from "./room-grid"
import { ReservationsTab } from "./reservations-tab"
import { HistoryTab } from "./history-tab"
import { FinancialTab } from "./financial-tab"
import { AuditLogTab } from "./audit-log-tab"
import { POSTab } from "./pos-tab"
import { StockTab } from "./stock/stock-tab"
import { ReportsTab } from "./reports-tab"
import { SettingsTab } from "./settings-tab"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Map, CalendarDays, DollarSign, Shield, ShoppingCart, Package, BarChart3, Settings, History } from "lucide-react"

export function DashboardShell() {
  const phone = usePhoneLayout()
  const { rooms, dataError } = useApp()
  const { can } = useAuth()
  const visible = (tab: string) => canAccessTab(tab, can)
  const permittedTab = Object.keys(tabPermissions).find(visible)
  const { activeTab, setActiveTab } = useActiveTab()
  const [visited, setVisited] = useState<string[]>([activeTab])
  useEffect(() => { setVisited(old => old.includes(activeTab) ? old : [...old, activeTab]) }, [activeTab])
  const retainLegacy = (tab: string) => phone && visited.includes(tab) ? true : undefined
  useEffect(() => {
    if (!canAccessTab(activeTab, can) && permittedTab) setActiveTab(permittedTab as typeof activeTab)
  }, [activeTab, can, permittedTab, setActiveTab])

  return (
    <div data-workspace={visible(activeTab) ? activeTab : permittedTab} className="dashboard-shell mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      {dataError && <div role="alert" className="rounded-lg border border-destructive p-4 text-destructive">Não foi possível atualizar os dados: {dataError}. Recarregue a página para tentar novamente.</div>}
      {phone && <MobileNavigation />}
      <div className="hidden sm:block"><DashboardHeader /></div>
      {!permittedTab && <p role="status">Nenhum módulo foi liberado para seu usuário. Procure o administrador.</p>}

      <Tabs value={visible(activeTab) ? activeTab : permittedTab ?? ""} onValueChange={(value) => setActiveTab(value as any)} className={`flex flex-col ${activeTab === "mapa" ? "gap-3" : "gap-6"}`}>
          <TabsList className="dashboard-module-tabs hidden w-full sm:flex">
          {visible("mapa") && (<TabsTrigger value="mapa" className="gap-1.5">
            <Map className="size-3.5" />
            Mapa
          </TabsTrigger>)}
          {visible("reservas") && (<TabsTrigger value="reservas" className="gap-1.5">
            <CalendarDays className="size-3.5" />
            Reservas
          </TabsTrigger>)}
          {visible("historico") && (<TabsTrigger value="historico" className="gap-1.5"><History className="size-3.5" />Histórico</TabsTrigger>)}
          {visible("pdv") && (<TabsTrigger value="pdv" className="gap-1.5">
            <ShoppingCart className="size-3.5" />
            Frente de Caixa
          </TabsTrigger>)}
          {visible("estoque") && (<TabsTrigger value="estoque" className="gap-1.5">
            <Package className="size-3.5" />
            Estoque
          </TabsTrigger>)}
          {visible("cadastros") && <TabsTrigger value="cadastros">Cadastros</TabsTrigger>}
          {visible("financeiro") && (<TabsTrigger value="financeiro" className="gap-1.5">
            <DollarSign className="size-3.5" />
            Financeiro
          </TabsTrigger>)}
          {visible("relatorios") && (<TabsTrigger value="relatorios" className="gap-1.5">
            <BarChart3 className="size-3.5" />
            Relatórios
          </TabsTrigger>)}
          {visible("configuracoes") && (<TabsTrigger value="configuracoes" className="gap-1.5">
            <Settings className="size-3.5" />
            Configurações
          </TabsTrigger>)}
          {visible("auditoria") && (<TabsTrigger value="auditoria" className="gap-1.5">
            <Shield className="size-3.5" />
            Auditoria
          </TabsTrigger>)}
        </TabsList>

        {visible("mapa") && (<TabsContent value="mapa" className="space-y-3">
          <RoomSummary rooms={rooms} />
          <RoomGrid />
        </TabsContent>)}
        {visible("reservas") && (<TabsContent value="reservas">
          <ReservationsTab />
        </TabsContent>)}
        {visible("historico") && (<TabsContent value="historico"><HistoryTab /></TabsContent>)}
        {visible("pdv") && (<TabsContent value="pdv">
          <POSTab />
        </TabsContent>)}
        {visible("estoque") && (<TabsContent value="estoque">
          <StockTab />
        </TabsContent>)}
        {visible("cadastros") && <TabsContent value="cadastros" forceMount={retainLegacy("cadastros")} className="data-[state=inactive]:hidden"><RegistrationsTab /></TabsContent>}
        {visible("financeiro") && (<TabsContent value="financeiro">
          <FinancialTab />
        </TabsContent>)}
        {visible("relatorios") && (<TabsContent value="relatorios" forceMount={retainLegacy("relatorios")} className="data-[state=inactive]:hidden">
          <ReportsTab />
        </TabsContent>)}
        {visible("configuracoes") && (<TabsContent value="configuracoes">
          <SettingsTab />
        </TabsContent>)}
        {visible("auditoria") && (<TabsContent value="auditoria" forceMount={retainLegacy("auditoria")} className="data-[state=inactive]:hidden">
          <AuditLogTab />
        </TabsContent>)}
      </Tabs>
    </div>
  )
}
