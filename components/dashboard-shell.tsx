"use client"

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
import { Map, CalendarDays, DollarSign, Shield, ShoppingCart, UtensilsCrossed, Package, BarChart3, Settings } from "lucide-react"

export function DashboardShell() {
  const { rooms } = useApp()
  const { isSupervisor } = useAuth()
  const { activeTab, setActiveTab } = useActiveTab()

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <DashboardHeader rooms={rooms} />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex flex-col gap-6">
          <TabsList className="w-fit">
          <TabsTrigger value="mapa" className="gap-1.5">
            <Map className="size-3.5" />
            Mapa
          </TabsTrigger>
          <TabsTrigger value="reservas" className="gap-1.5">
            <CalendarDays className="size-3.5" />
            Reservas
          </TabsTrigger>
          <TabsTrigger value="pdv" className="gap-1.5">
            <ShoppingCart className="size-3.5" />
            Frente de Caixa
          </TabsTrigger>
          <TabsTrigger value="restaurante" className="gap-1.5">
            <UtensilsCrossed className="size-3.5" />
            Restaurante
          </TabsTrigger>
          <TabsTrigger value="estoque" className="gap-1.5">
            <Package className="size-3.5" />
            Estoque
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-1.5">
            <DollarSign className="size-3.5" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5">
            <BarChart3 className="size-3.5" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-1.5">
            <Settings className="size-3.5" />
            Configurações
          </TabsTrigger>
          {isSupervisor && (
            <TabsTrigger value="administracao" className="gap-1.5">
              <Shield className="size-3.5" />
              Administração
            </TabsTrigger>
          )}
          <TabsTrigger value="auditoria" className="gap-1.5">
            <Shield className="size-3.5" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapa">
          <RoomGrid />
        </TabsContent>
        <TabsContent value="reservas">
          <ReservationsTab />
        </TabsContent>
        <TabsContent value="pdv">
          <POSTab />
        </TabsContent>
        <TabsContent value="restaurante">
          <RestaurantTab />
        </TabsContent>
        <TabsContent value="estoque">
          <StockTab />
        </TabsContent>
        <TabsContent value="financeiro">
          <FinancialTab />
        </TabsContent>
        <TabsContent value="relatorios">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="configuracoes">
          <SettingsTab />
        </TabsContent>
        {isSupervisor && (
          <TabsContent value="administracao">
            <AdminTab />
          </TabsContent>
        )}
        <TabsContent value="auditoria">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
