"use client"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import CustomersManagement from "./customers-management"
import { SuppliersManagement } from "./suppliers-management"
import { ManageRoomsModal } from "./manage-rooms-modal"
import { LodgingTariffsManagement } from "./lodging-tariffs-management"
import { ProductsManagementTab } from "./stock/products-management-tab"
import { Button } from "./ui/button"

export function RegistrationsTab() {
  const { can } = useAuth()
  const sections = [{ key: "people", label: "Pessoas e empresas", permission: "customers.read" }, { key: "suppliers", label: "Fornecedores", permission: "suppliers.read" }, { key: "rooms", label: "Quartos e tarifas", permission: "lodgingTariffs.read" }, { key: "beverages", label: "Bebidas", permission: "posProducts.read" }].filter(s => can(s.permission))
  const [section, setSection] = useState(sections[0]?.key)
  const [roomModal, setRoomModal] = useState(false)
  const current = sections.some(s => s.key === section) ? section : sections[0]?.key
  return <div className="space-y-5"><nav aria-label="Áreas de cadastro" className="flex flex-wrap gap-2">{sections.map(s => <Button key={s.key} variant={current === s.key ? "default" : "outline"} onClick={() => setSection(s.key)} aria-current={current === s.key ? "page" : undefined}>{s.label}</Button>)}</nav>
    {current === "people" && <CustomersManagement />}{current === "suppliers" && <SuppliersManagement />}{current === "beverages" && <ProductsManagementTab />}
    {current === "rooms" && <div className="space-y-5">{(can("rooms.edit") || can("rooms.create")) && <Button variant="outline" onClick={() => setRoomModal(true)}>Quartos e capacidades</Button>}<LodgingTariffsManagement /><ManageRoomsModal open={roomModal} onClose={() => setRoomModal(false)} /></div>}
  </div>
}
