"use client"

import { useEffect } from "react"
import { useApp } from "@/lib/app-context"
import { useActiveTab } from "@/contexts/active-tab-context"

const TAB_NAMES: Record<string, string> = {
  mapa: "Mapa",
  reservas: "Reservas",
  pdv: "Frente de Caixa",
  estoque: "Estoque",
  financeiro: "Financeiro",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
  administracao: "Administração",
  auditoria: "Auditoria",
}

export function DynamicTitle() {
  const { systemSettings } = useApp()
  const { activeTab } = useActiveTab()

  useEffect(() => {
    const tabName = TAB_NAMES[activeTab] || "Dashboard"
    document.title = `${systemSettings.pousadaName} - ${tabName}`
  }, [systemSettings.pousadaName, activeTab])

  return null
}
