"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import type { StockDestination } from "@/lib/notification-destination"

type TabValue = "cadastros" | "mapa" | "reservas" | "pdv" | "estoque" | "financeiro" | "relatorios" | "configuracoes" | "administracao" | "auditoria"

interface ActiveTabContextType {
  activeTab: TabValue
  setActiveTab: (tab: TabValue) => void
  stockDestination?: StockDestination
  openStock: (destination:StockDestination)=>void
}

const ActiveTabContext = createContext<ActiveTabContextType | undefined>(undefined)
export function useStockNavigation(){return useContext(ActiveTabContext)}

export function useActiveTab() {
  const context = useContext(ActiveTabContext)
  if (!context) {
    throw new Error("useActiveTab must be used within ActiveTabProvider")
  }
  return context
}

export function ActiveTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, updateActiveTab] = useState<TabValue>("mapa")
  const [stockDestination,setStockDestination]=useState<StockDestination>()
  const setActiveTab=(tab:TabValue)=>{setStockDestination(undefined);updateActiveTab(tab)}
  const openStock=(destination:StockDestination)=>{setStockDestination({...destination});updateActiveTab("estoque")}

  return (
    <ActiveTabContext.Provider value={{ activeTab, setActiveTab,stockDestination,openStock }}>
      {children}
    </ActiveTabContext.Provider>
  )
}
