"use client"

import { createContext, useContext, useState, ReactNode } from "react"

type TabValue = "mapa" | "reservas" | "pdv" | "estoque" | "financeiro" | "relatorios" | "configuracoes" | "administracao" | "auditoria"

interface ActiveTabContextType {
  activeTab: TabValue
  setActiveTab: (tab: TabValue) => void
}

const ActiveTabContext = createContext<ActiveTabContextType | undefined>(undefined)

export function useActiveTab() {
  const context = useContext(ActiveTabContext)
  if (!context) {
    throw new Error("useActiveTab must be used within ActiveTabProvider")
  }
  return context
}

export function ActiveTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabValue>("mapa")

  return (
    <ActiveTabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </ActiveTabContext.Provider>
  )
}
