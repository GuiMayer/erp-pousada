"use client"

import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { DashboardHeader } from "./dashboard-header"
import { RoomGrid } from "./room-grid"
import { ReservationsTab } from "./reservations-tab"
import { FinancialTab } from "./financial-tab"
import { AuditLogTab } from "./audit-log-tab"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Map, CalendarDays, DollarSign, Shield } from "lucide-react"

export function DashboardShell() {
  const { rooms } = useApp()

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <DashboardHeader rooms={rooms} />

      <Tabs defaultValue="mapa" className="flex flex-col gap-6">
        <TabsList className="w-fit">
          <TabsTrigger value="mapa" className="gap-1.5">
            <Map className="size-3.5" />
            Mapa
          </TabsTrigger>
          <TabsTrigger value="reservas" className="gap-1.5">
            <CalendarDays className="size-3.5" />
            Reservas
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-1.5">
            <DollarSign className="size-3.5" />
            Financeiro
          </TabsTrigger>
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
        <TabsContent value="financeiro">
          <FinancialTab />
        </TabsContent>
        <TabsContent value="auditoria">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
