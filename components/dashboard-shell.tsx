"use client"
import { useEffect } from "react"
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
import { RestaurantTab } from "./restaurant/restaurant-tab"
import { StockTab } from "./stock/stock-tab"
import { ReportsTab } from "./reports-tab"
import { SettingsTab } from "./settings-tab"
import { AdminTab } from "./admin-tab"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Map, CalendarDays, DollarSign, Shield, ShoppingCart, UtensilsCrossed, Package, BarChart3, Settings } from "lucide-react"

const moduleLabels: Record<string, string> = {
  mapa: "Mapa", reservas: "Reservas", pdv: "Frente de Caixa", restaurante: "Restaurante",
  estoque: "Estoque", financeiro: "Financeiro", relatorios: "Relatórios",
  configuracoes: "Configurações", administracao: "Administração", auditoria: "Auditoria",
}

export function DashboardShell() {
  const { rooms, dataError } = useApp()
  const { can } = useAuth()
  const visible = (tab: string) => tabPermissions[tab]?.some(can)
  const permittedTab = Object.keys(tabPermissions).find(visible)
  const { activeTab, setActiveTab } = useActiveTab()
  useEffect(() => {
    if (!tabPermissions[activeTab]?.some(can) && permittedTab) setActiveTab(permittedTab as typeof activeTab)
  }, [activeTab, can, permittedTab, setActiveTab])

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 px-4 py-4 sm:gap-8 sm:px-6 sm:py-8 lg:px-8">
      {dataError && <div role="alert" className="rounded-lg border border-destructive p-4 text-destructive">Não foi possível atualizar os dados: {dataError}. Recarregue a página para tentar novamente.</div>}
      <DashboardHeader rooms={rooms} />
      {!permittedTab && <p role="status">Nenhum módulo foi liberado para seu usuário. Procure o administrador.</p>}

      <Tabs value={visible(activeTab) ? activeTab : permittedTab ?? ""} onValueChange={(value) => setActiveTab(value as any)} className="flex flex-col gap-6">
        <div className="sm:hidden">
          <Select value={visible(activeTab) ? activeTab : permittedTab ?? ""} onValueChange={value => setActiveTab(value as typeof activeTab)}>
            <SelectTrigger aria-label="Navegar entre módulos" className="w-full min-h-11"><SelectValue placeholder="Escolha um módulo" /></SelectTrigger>
            <SelectContent>{Object.entries(moduleLabels).filter(([key]) => visible(key)).map(([key, label]) => <SelectItem key={key} value={key} className="min-h-11">{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
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
          {visible("restaurante") && (<TabsTrigger value="restaurante" className="gap-1.5">
            <UtensilsCrossed className="size-3.5" />
            Restaurante
          </TabsTrigger>)}
          {visible("estoque") && (<TabsTrigger value="estoque" className="gap-1.5">
            <Package className="size-3.5" />
            Estoque
          </TabsTrigger>)}
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

        {visible("mapa") && (<TabsContent value="mapa">
          <RoomGrid />
        </TabsContent>)}
        {visible("reservas") && (<TabsContent value="reservas">
          <ReservationsTab />
        </TabsContent>)}
        {visible("pdv") && (<TabsContent value="pdv">
          <POSTab />
        </TabsContent>)}
        {visible("restaurante") && (<TabsContent value="restaurante">
          <RestaurantTab />
        </TabsContent>)}
        {visible("estoque") && (<TabsContent value="estoque">
          <StockTab />
        </TabsContent>)}
        {visible("financeiro") && (<TabsContent value="financeiro">
          <FinancialTab />
        </TabsContent>)}
        {visible("relatorios") && (<TabsContent value="relatorios">
          <ReportsTab />
        </TabsContent>)}
        {visible("configuracoes") && (<TabsContent value="configuracoes">
          <SettingsTab />
        </TabsContent>)}
        {visible("administracao") && (<TabsContent value="administracao">
            <AdminTab />
          </TabsContent>)}
        {visible("auditoria") && (<TabsContent value="auditoria">
          <AuditLogTab />
        </TabsContent>)}
      </Tabs>
    </div>
  )
}
