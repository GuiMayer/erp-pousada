"use client"

import { useState } from "react"
import { UtensilsCrossed, Settings, ChefHat, Users, Factory, Coffee, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableGrid } from "./table-grid"
import { OrderSheet } from "./order-sheet"
import { ManageTablesModal } from "./manage-tables-modal"
import { ManageRecipesModal } from "./manage-recipes-modal"
import { ManageEmployeesModal } from "./manage-employees-modal"
import { ProductionModal } from "./production-modal"
import { EmployeeConsumptionModal } from "./employee-consumption-modal"
import { useTableManagement } from "@/lib/hooks/useTableManagement"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import type { RestaurantTable, RestaurantOrder, TableStatus } from "@/lib/store"
import { generateOrderId } from "@/lib/utils/id-generators"
import { formatCurrency } from "@/lib/utils/formatters"

export function RestaurantTab() {
  const {
    addRestaurantOrder, updateRestaurantTable,
    productions, updateProduction, removeProduction,
    employeeConsumptions, updateEmployeeConsumption, removeEmployeeConsumption,
    addAuditEntry,
  } = useApp()
  const { username } = useAuth()
  const {
    tables,
    filter,
    setFilter,
    stats,
    getOccupiedTime,
    openTable,
    closeTable,
  } = useTableManagement()

  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null)
  const [orderSheetOpen, setOrderSheetOpen] = useState(false)
  const [manageTablesOpen, setManageTablesOpen] = useState(false)
  const [manageRecipesOpen, setManageRecipesOpen] = useState(false)
  const [manageEmployeesOpen, setManageEmployeesOpen] = useState(false)
  const [productionOpen, setProductionOpen] = useState(false)
  const [consumptionOpen, setConsumptionOpen] = useState(false)

  async function archiveProduction(id: string) {
    const production = productions.find(item => item.id === id)
    if (!production) return
    if (!confirm(`Remover producao de ${production.recipeName}?`)) return

    await removeProduction(id)
    await addAuditEntry({ user: username || "sistema", action: "Producao removida", reference: production.recipeName })
  }

  async function updateProductionNotes(id: string) {
    const production = productions.find(item => item.id === id)
    if (!production) return
    const notes = prompt("Observacoes da producao", production.notes || "")
    if (notes === null) return

    await updateProduction(id, { notes: notes.trim() || undefined })
    await addAuditEntry({ user: username || "sistema", action: "Producao editada", reference: production.recipeName })
  }

  async function removeConsumption(id: string) {
    const consumption = employeeConsumptions.find(item => item.id === id)
    if (!consumption) return
    if (!confirm(`Remover consumo de ${consumption.employeeName}?`)) return

    await removeEmployeeConsumption(id)
    await addAuditEntry({ user: username || "sistema", action: "Consumo de funcionario removido", reference: consumption.employeeName })
  }

  async function updateConsumptionNotes(id: string) {
    const consumption = employeeConsumptions.find(item => item.id === id)
    if (!consumption) return
    const notes = prompt("Observacoes do consumo", consumption.notes || "")
    if (notes === null) return

    await updateEmployeeConsumption(id, { notes: notes.trim() || undefined })
    await addAuditEntry({ user: username || "sistema", action: "Consumo de funcionario editado", reference: consumption.employeeName })
  }

  const handleTableClick = (table: RestaurantTable) => {
    if (table.status === "livre") {
      // Open new order
      const orderId = generateOrderId()
      const newOrder: RestaurantOrder = {
        id: orderId,
        tableId: table.id,
        tableNumber: table.number,
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0,
        status: "aberta",
        openedAt: new Date().toISOString(),
        operator: "operador",
      }
      addRestaurantOrder(newOrder)
      openTable(table.id, orderId)
      setSelectedTable({ ...table, currentOrderId: orderId })
    } else {
      setSelectedTable(table)
    }
    setOrderSheetOpen(true)
  }

  const handleOrderSheetClose = () => {
    setOrderSheetOpen(false)
    setSelectedTable(null)
  }

  const handleOrderPaid = async (table: RestaurantTable) => {
    await closeTable(table.id)
    handleOrderSheetClose()
  }

  const handleOrderCanceled = async (table: RestaurantTable) => {
    await closeTable(table.id)
    handleOrderSheetClose()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="h-8 w-8" />
            Restaurante
          </h2>
          <p className="text-muted-foreground">
            Gerencie mesas e comandas do restaurante
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setProductionOpen(true)}
          >
            <Factory className="size-4" />
            Produção
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setConsumptionOpen(true)}
          >
            <Coffee className="size-4" />
            Consumo
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setManageRecipesOpen(true)}
          >
            <ChefHat className="size-4" />
            Receitas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setManageEmployeesOpen(true)}
          >
            <Users className="size-4" />
            Funcionários
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setManageTablesOpen(true)}
          >
            <Settings className="size-4" />
            Gerenciar Mesas
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Total de Mesas</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Ocupadas</div>
          <div className="text-2xl font-bold text-orange-600">{stats.occupied}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Livres</div>
          <div className="text-2xl font-bold text-green-600">{stats.free}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Taxa de Ocupação</div>
          <div className="text-2xl font-bold">{stats.occupancyRate}%</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Select value={filter} onValueChange={(value) => setFilter(value as TableStatus | "all")}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Mesas</SelectItem>
              <SelectItem value="livre">Livres</SelectItem>
              <SelectItem value="ocupada">Ocupadas</SelectItem>
              <SelectItem value="reservada">Reservadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tables Grid */}
      <TableGrid
        tables={tables}
        onTableClick={handleTableClick}
        getOccupiedTime={getOccupiedTime}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Producoes</h3>
            <span className="text-xs text-muted-foreground">{productions.length} registro(s)</span>
          </div>
          <div className="space-y-2">
            {productions.slice(0, 5).map(production => (
              <div key={production.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">{production.recipeName}</div>
                  <div className="text-xs text-muted-foreground">{new Date(production.timestamp).toLocaleString("pt-BR")} - {formatCurrency(production.totalCost)}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => updateProductionNotes(production.id)}><Pencil className="size-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => archiveProduction(production.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
            {productions.length === 0 && <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Nenhuma producao registrada.</div>}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Consumos de Funcionarios</h3>
            <span className="text-xs text-muted-foreground">{employeeConsumptions.length} registro(s)</span>
          </div>
          <div className="space-y-2">
            {employeeConsumptions.slice(0, 5).map(consumption => (
              <div key={consumption.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">{consumption.employeeName}</div>
                  <div className="text-xs text-muted-foreground">{new Date(consumption.timestamp).toLocaleString("pt-BR")} - {formatCurrency(consumption.total)}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => updateConsumptionNotes(consumption.id)}><Pencil className="size-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => removeConsumption(consumption.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
            {employeeConsumptions.length === 0 && <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Nenhum consumo registrado.</div>}
          </div>
        </div>
      </div>

      {/* Order Sheet */}
      <OrderSheet
        open={orderSheetOpen}
        onOpenChange={(open) => {
          if (open) {
            setOrderSheetOpen(true)
          } else {
            handleOrderSheetClose()
          }
        }}
        table={selectedTable}
        onClose={handleOrderSheetClose}
        onPaid={handleOrderPaid}
        onCanceled={handleOrderCanceled}
      />

      {/* Manage Tables Modal */}
      <ManageTablesModal
        open={manageTablesOpen}
        onClose={() => setManageTablesOpen(false)}
      />

      {/* Manage Recipes Modal */}
      <ManageRecipesModal
        open={manageRecipesOpen}
        onClose={() => setManageRecipesOpen(false)}
      />

      {/* Manage Employees Modal */}
      <ManageEmployeesModal
        open={manageEmployeesOpen}
        onClose={() => setManageEmployeesOpen(false)}
      />

      {/* Production Modal */}
      <ProductionModal
        open={productionOpen}
        onClose={() => setProductionOpen(false)}
      />

      {/* Employee Consumption Modal */}
      <EmployeeConsumptionModal
        open={consumptionOpen}
        onClose={() => setConsumptionOpen(false)}
      />
    </div>
  )
}
