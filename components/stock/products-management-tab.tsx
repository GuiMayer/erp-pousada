"use client"
import { PermissionGate } from "@/components/permission-gate"

import { useState, useMemo } from "react"
import { Package, Plus, Search, Edit, Trash2, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { ProductFormModal } from "./product-form-modal"
import { ManageCategoriesModal } from "../manage-categories-modal"
import { useApp } from "@/lib/app-context"
import type { POSProduct } from "@/lib/store"

export function ProductsManagementTab() {
  const { posProducts, stockItems, removePOSProduct, productCategories } = useApp()

  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<POSProduct | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<POSProduct | null>(null)

  // Filter only PDV products (not restaurant)
  const pdvProducts = useMemo(() => {
    return posProducts.filter(product => {
      const category = productCategories.find(c => c.id === product.categoryId)
      return category?.isRestaurant !== true
    })
  }, [posProducts, productCategories])

  // Get unique PDV categories
  const pdvCategories = useMemo(() => {
    const cats = productCategories.filter(c => !c.isRestaurant)
    return cats.sort((a, b) => a.name.localeCompare(b.name))
  }, [productCategories])

  // Filter products
  const filteredProducts = useMemo(() => {
    return pdvProducts.filter(product => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = product.name.toLowerCase().includes(query)
        const matchesBarcode = product.barcode?.toLowerCase().includes(query)
        if (!matchesName && !matchesBarcode) return false
      }

      // Category filter
      if (categoryFilter !== "all" && product.categoryId !== categoryFilter) {
        return false
      }

      // Stock filter
      if (stockFilter !== "all") {
        const hasStock = stockItems.some(s => s.productId === product.id)
        if (stockFilter === "with-stock" && !hasStock) return false
        if (stockFilter === "without-stock" && hasStock) return false
      }

      return true
    })
  }, [pdvProducts, stockItems, searchQuery, categoryFilter, stockFilter])

  function handleEdit(product: POSProduct) {
    setSelectedProduct(product)
    setProductFormOpen(true)
  }

  function handleAdd() {
    setSelectedProduct(undefined)
    setProductFormOpen(true)
  }

  function handleDelete(product: POSProduct) {
    setDeleteConfirm(product)
  }

  function confirmDelete() {
    if (deleteConfirm) {
      removePOSProduct(deleteConfirm.id)
      setDeleteConfirm(null)
    }
  }

  function hasStockItem(productId: string): boolean {
    return stockItems.some(s => s.productId === productId)
  }

  function getCategoryName(categoryId: string): string {
    const category = productCategories.find(c => c.id === categoryId)
    return category?.name || categoryId
  }

  function getCategoryColor(categoryId: string): string {
    const category = productCategories.find(c => c.id === categoryId)
    return category?.color || "#6b7280"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" />
            Catálogo de Produtos
          </h3>
          <p className="text-muted-foreground">
            Gerencie o catálogo central de produtos usado em todos os sistemas
          </p>
        </div>
        <div className="flex gap-2">
          <PermissionGate permission="productCategories.edit"><Button variant="outline" onClick={() => setCategoriesModalOpen(true)}>
            <Tag className="h-4 w-4 mr-2" />
            Categorias
          </Button></PermissionGate>
          <PermissionGate permission="posProducts.create"><Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button></PermissionGate>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Total de Produtos</div>
          <div className="text-2xl font-bold">{pdvProducts.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Com Estoque</div>
          <div className="text-2xl font-bold text-green-600">
            {pdvProducts.filter(p => hasStockItem(p.id)).length}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Sem Estoque</div>
          <div className="text-2xl font-bold text-gray-600">
            {pdvProducts.filter(p => !hasStockItem(p.id)).length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código de barras..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {pdvCategories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por estoque" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="with-stock">Com estoque</SelectItem>
            <SelectItem value="without-stock">Sem estoque</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto encontrado"
          description={searchQuery || categoryFilter !== "all" || stockFilter !== "all"
            ? "Nenhum produto corresponde aos filtros selecionados."
            : "Adicione produtos ao catálogo para começar."}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Código de Barras</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      style={{ 
                        backgroundColor: `${getCategoryColor(product.categoryId)}20`,
                        borderColor: getCategoryColor(product.categoryId),
                        color: getCategoryColor(product.categoryId)
                      }}
                    >
                      {getCategoryName(product.categoryId)}
                    </Badge>
                  </TableCell>
                  <TableCell>R$ {product.price.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.barcode || "-"}
                  </TableCell>
                  <TableCell>
                    {hasStockItem(product.id) ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">
                        Controlado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-500/10 text-gray-700 border-gray-200">
                        Não controlado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <PermissionGate permission="posProducts.edit"><Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button></PermissionGate>
                      <PermissionGate permission="posProducts.delete"><Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(product)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button></PermissionGate>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Product Form Modal */}
      <ProductFormModal
        open={productFormOpen}
        onClose={() => setProductFormOpen(false)}
        product={selectedProduct}
        categoryType="pdv"
      />

      {/* Categories Modal */}
      <ManageCategoriesModal
        open={categoriesModalOpen}
        onClose={() => setCategoriesModalOpen(false)}
        defaultTab="pdv"
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto <strong>{deleteConfirm?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
