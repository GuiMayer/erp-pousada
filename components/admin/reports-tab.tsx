/**
 * Reports Tab Component
 * 
 * Provides UI for generating PDF reports for reservations, stock, and restaurant.
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { FileText, Download } from "lucide-react"
import { useStore } from "@/lib/store"
import { downloadReservationsReport } from "@/lib/reports/reservations-report"
import { downloadStockReport } from "@/lib/reports/stock-report"
import { downloadRestaurantReport } from "@/lib/reports/restaurant-report"
import type { Reservation, Product, RestaurantOrder } from "@/lib/store"
import { toast } from "sonner"

export function ReportsTab() {
  const { 
    reservations, 
    rooms, 
    products, 
    productCategories,
    restaurantOrders,
    restaurantProducts,
    restaurantProductCategories,
    systemSettings 
  } = useStore()

  // Reservations filters
  const [reservationStartDate, setReservationStartDate] = useState("")
  const [reservationEndDate, setReservationEndDate] = useState("")
  const [reservationStatus, setReservationStatus] = useState<Reservation["status"] | "all">("all")
  const [reservationRoomId, setReservationRoomId] = useState<string | "all">("all")

  // Stock filters
  const [stockCategoryId, setStockCategoryId] = useState<string | "all">("all")
  const [stockType, setStockType] = useState<Product["type"] | "all">("all")
  const [stockLowStock, setStockLowStock] = useState(false)

  // Restaurant filters
  const [restaurantStartDate, setRestaurantStartDate] = useState("")
  const [restaurantEndDate, setRestaurantEndDate] = useState("")
  const [restaurantStatus, setRestaurantStatus] = useState<RestaurantOrder["status"] | "all">("all")
  const [restaurantCategoryId, setRestaurantCategoryId] = useState<string | "all">("all")

  const handleGenerateReservationsReport = () => {
    try {
      downloadReservationsReport(
        {
          reservations,
          rooms,
          filters: {
            startDate: reservationStartDate || undefined,
            endDate: reservationEndDate || undefined,
            status: reservationStatus,
            roomId: reservationRoomId,
          },
        },
        systemSettings
      )
      toast.success("Relatório de reservas gerado com sucesso!")
    } catch (error) {
      console.error("Error generating reservations report:", error)
      toast.error("Erro ao gerar relatório de reservas")
    }
  }

  const handleGenerateStockReport = () => {
    try {
      downloadStockReport(
        {
          products,
          categories: productCategories,
          filters: {
            categoryId: stockCategoryId,
            type: stockType,
            lowStock: stockLowStock,
          },
        },
        systemSettings
      )
      toast.success("Relatório de estoque gerado com sucesso!")
    } catch (error) {
      console.error("Error generating stock report:", error)
      toast.error("Erro ao gerar relatório de estoque")
    }
  }

  const handleGenerateRestaurantReport = () => {
    try {
      downloadRestaurantReport(
        {
          orders: restaurantOrders,
          products: restaurantProducts,
          categories: restaurantProductCategories,
          filters: {
            startDate: restaurantStartDate || undefined,
            endDate: restaurantEndDate || undefined,
            status: restaurantStatus,
            categoryId: restaurantCategoryId,
          },
        },
        systemSettings
      )
      toast.success("Relatório de restaurante gerado com sucesso!")
    } catch (error) {
      console.error("Error generating restaurant report:", error)
      toast.error("Erro ao gerar relatório de restaurante")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Relatórios</h2>
        <p className="text-muted-foreground">
          Gere relatórios em PDF com filtros personalizados
        </p>
      </div>

      {/* Reservations Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatório de Reservas
          </CardTitle>
          <CardDescription>
            Gere um relatório detalhado das reservas com estatísticas e análises
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reservation-start-date">Data Início</Label>
              <Input
                id="reservation-start-date"
                type="date"
                value={reservationStartDate}
                onChange={(e) => setReservationStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservation-end-date">Data Fim</Label>
              <Input
                id="reservation-end-date"
                type="date"
                value={reservationEndDate}
                onChange={(e) => setReservationEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservation-status">Status</Label>
              <Select value={reservationStatus} onValueChange={(value) => setReservationStatus(value as any)}>
                <SelectTrigger id="reservation-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="checkedIn">Check-in</SelectItem>
                  <SelectItem value="checkedOut">Check-out</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservation-room">Quarto</Label>
              <Select value={reservationRoomId} onValueChange={setReservationRoomId}>
                <SelectTrigger id="reservation-room">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleGenerateReservationsReport} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Gerar Relatório de Reservas
          </Button>
        </CardContent>
      </Card>

      {/* Stock Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatório de Estoque
          </CardTitle>
          <CardDescription>
            Gere um relatório detalhado do estoque com análises de valor e categorias
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock-category">Categoria</Label>
              <Select value={stockCategoryId} onValueChange={setStockCategoryId}>
                <SelectTrigger id="stock-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {productCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock-type">Tipo</Label>
              <Select value={stockType} onValueChange={(value) => setStockType(value as any)}>
                <SelectTrigger id="stock-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="consumable">Consumível</SelectItem>
                  <SelectItem value="sellable">Vendável</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="stock-low-stock"
              checked={stockLowStock}
              onCheckedChange={(checked) => setStockLowStock(checked as boolean)}
            />
            <Label htmlFor="stock-low-stock" className="cursor-pointer">
              Apenas produtos com estoque baixo
            </Label>
          </div>
          <Button onClick={handleGenerateStockReport} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Gerar Relatório de Estoque
          </Button>
        </CardContent>
      </Card>

      {/* Restaurant Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatório de Restaurante
          </CardTitle>
          <CardDescription>
            Gere um relatório detalhado dos pedidos do restaurante com análises de vendas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="restaurant-start-date">Data Início</Label>
              <Input
                id="restaurant-start-date"
                type="date"
                value={restaurantStartDate}
                onChange={(e) => setRestaurantStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurant-end-date">Data Fim</Label>
              <Input
                id="restaurant-end-date"
                type="date"
                value={restaurantEndDate}
                onChange={(e) => setRestaurantEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurant-status">Status</Label>
              <Select value={restaurantStatus} onValueChange={(value) => setRestaurantStatus(value as any)}>
                <SelectTrigger id="restaurant-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="preparing">Preparando</SelectItem>
                  <SelectItem value="ready">Pronto</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurant-category">Categoria</Label>
              <Select value={restaurantCategoryId} onValueChange={setRestaurantCategoryId}>
                <SelectTrigger id="restaurant-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {restaurantProductCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleGenerateRestaurantReport} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Gerar Relatório de Restaurante
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
