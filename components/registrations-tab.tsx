"use client"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import CustomersManagement from "./customers-management"
import { SuppliersManagement } from "./suppliers-management"
import { ManageRoomsModal } from "./manage-rooms-modal"
import { LodgingTariffsManagement } from "./lodging-tariffs-management"
import { ProductsManagementTab } from "./stock/products-management-tab"
import { FinancialDefinitions } from "./financial-definitions"
import { GuestsManagement } from "./guests-management"
import { Button } from "./ui/button"

export function RegistrationsTab() {
  const { can } = useAuth()
  const sections = [{ key: "people", label: "Pessoas e empresas", permissions: ["customers.read", "guests.read"] }, { key: "suppliers", label: "Fornecedores", permissions: ["suppliers.read"] }, { key: "rooms", label: "Quartos e tarifas", permissions: ["lodgingTariffs.read"] }, { key: "beverages", label: "Bebidas", permissions: ["posProducts.read"] }, { key: "financial", label: "Financeiros", permissions: ["bankAccounts.read", "costCenters.read", "categories.read"] }].filter(s => s.permissions.some(can))
  const [section, setSection] = useState(sections[0]?.key)
  const [roomModal, setRoomModal] = useState(false)
  const current = sections.some(s => s.key === section) ? section : sections[0]?.key
  return <div className="space-y-5"><nav aria-label="Áreas de cadastro" className="flex flex-wrap gap-2">{sections.map(s => <Button key={s.key} variant={current === s.key ? "default" : "outline"} onClick={() => setSection(s.key)} aria-current={current === s.key ? "page" : undefined}>{s.label}</Button>)}</nav>
    {current === "people" && (can("customers.read") ? <CustomersManagement /> : <GuestsManagement />)}{current === "financial" && <FinancialDefinitions />}{current === "suppliers" && <SuppliersManagement />}{current === "beverages" && <ProductsManagementTab />}
    {current === "rooms" && <div className="space-y-5">{(can("rooms.edit") || can("rooms.create")) && <Button variant="outline" onClick={() => setRoomModal(true)}>Quartos e capacidades</Button>}<LodgingTariffsManagement /><ManageRoomsModal open={roomModal} onClose={() => setRoomModal(false)} /></div>}
  </div>
}
