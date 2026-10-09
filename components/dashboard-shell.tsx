"use client"
import { RegistrationsTab } from "./registrations-tab"
import { MobileNavigation } from "./mobile-navigation"
import { usePhoneLayout } from "@/hooks/use-phone-layout"
import { useEffect, useState } from "react"
import { tabPermissions } from "@/lib/permissions"

import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useActiveTab } from "@/contexts/active-tab-context"
import { DashboardHeader } from "./dashboard-header"
import { RoomGrid } from "./room-grid"
import { ReservationsTab } from "./reservations-tab"
import { FinancialTab } from "./financial-tab"
import { AuditLogTab } from "./audit-log-tab"
import { POSTab } from "./pos-tab"
import { StockTab } from "./stock/stock-tab"
import { ReportsTab } from "./reports-tab"
import { SettingsTab } from "./settings-tab"
import { AdminTab } from "./admin-tab"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Map, CalendarDays, DollarSign, Shield, ShoppingCart, Package, BarChart3, Settings } from "lucide-react"

export function DashboardShell() {
  const phone = usePhoneLayout()
  const { rooms, dataError } = useApp()
  const { can } = useAuth()
  const visible = (tab: string) => tabPermissions[tab]?.some(can)
  const permittedTab = Object.keys(tabPermissions).find(visible)
  const { activeTab, setActiveTab } = useActiveTab()
  const [visited, setVisited] = useState(() => new Set([activeTab]))
  useEffect(() => {
    if (phone) setVisited(previous => previous.has(activeTab) ? previous : new Set([...previous, activeTab]))
  }, [activeTab, phone])
  useEffect(() => {
    if (!tabPermissions[activeTab]?.some(can) && permittedTab) setActiveTab(permittedTab as typeof activeTab)
  }, [activeTab, can, permittedTab, setActiveTab])

  return (
    <div className="dashboard-shell mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 px-4 py-4 sm:gap-8 sm:px-6 sm:py-8 lg:px-8">
      {dataError && <div role="alert" className="rounded-lg border border-destructive p-4 text-destructive">Não foi possível atualizar os dados: {dataError}. Recarregue a página para tentar novamente.</div>}
      {phone && <MobileNavigation />}
      <div className="hidden sm:block"><DashboardHeader rooms={rooms} /></div>
      {!permittedTab && <p role="status">Nenhum módulo foi liberado para seu usuário. Procure o administrador.</p>}

      <Tabs value={visible(activeTab) ? activeTab : permittedTab ?? ""} onValueChange={(value) => setActiveTab(value as any)} className="flex flex-col gap-6">
          <TabsList className="hidden sm:flex">
          {visible("mapa") && (<TabsTrigger value="mapa" className="gap-1.5">
            <Map className="size-3.5" />
            Mapa
          </TabsTrigger>)}
          {visible("reservas") && (<TabsTrigger value="reservas" className="gap-1.5">
            <CalendarDays className="size-3.5" />
            Reservas
          </TabsTrigger>)}
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
          {visible("administracao") && (<TabsTrigger value="administracao" className="gap-1.5">
              <Shield className="size-3.5" />
              Administração
            </TabsTrigger>)}
          {visible("auditoria") && (<TabsTrigger value="auditoria" className="gap-1.5">
            <Shield className="size-3.5" />
            Auditoria
          </TabsTrigger>)}
        </TabsList>

        {visible("mapa") && (<TabsContent forceMount={phone && visited.has("mapa") ? true : undefined} value="mapa">
          <RoomGrid />
        </TabsContent>)}
        {visible("reservas") && (<TabsContent forceMount={phone && visited.has("reservas") ? true : undefined} value="reservas">
          <ReservationsTab />
        </TabsContent>)}
        {visible("pdv") && (<TabsContent forceMount={phone && visited.has("pdv") ? true : undefined} value="pdv">
          <POSTab />
        </TabsContent>)}
        {visible("estoque") && (<TabsContent forceMount={phone && visited.has("estoque") ? true : undefined} value="estoque">
          <StockTab />
        </TabsContent>)}
        {visible("cadastros") && <TabsContent forceMount={phone && visited.has("cadastros") ? true : undefined} value="cadastros"><RegistrationsTab /></TabsContent>}
        {visible("financeiro") && (<TabsContent forceMount={phone && visited.has("financeiro") ? true : undefined} value="financeiro">
          <FinancialTab />
        </TabsContent>)}
        {visible("relatorios") && (<TabsContent forceMount={phone && visited.has("relatorios") ? true : undefined} value="relatorios">
          <ReportsTab />
        </TabsContent>)}
        {visible("configuracoes") && (<TabsContent forceMount={phone && visited.has("configuracoes") ? true : undefined} value="configuracoes">
          <SettingsTab />
        </TabsContent>)}
        {visible("administracao") && (<TabsContent forceMount={phone && visited.has("administracao") ? true : undefined} value="administracao">
            <AdminTab />
          </TabsContent>)}
        {visible("auditoria") && (<TabsContent forceMount={phone && visited.has("auditoria") ? true : undefined} value="auditoria">
          <AuditLogTab />
        </TabsContent>)}
      </Tabs>
    </div>
  )
}
