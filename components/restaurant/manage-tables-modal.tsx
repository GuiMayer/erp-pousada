"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Plus, Pencil, Trash2, UtensilsCrossed } from "lucide-react"
import type { RestaurantTable } from "@/lib/store"

type Props = {
  open: boolean
  onClose: () => void
}

export function ManageTablesModal({ open, onClose }: Props) {
  const { restaurantTables, addRestaurantTable, updateRestaurantTable, removeRestaurantTable, addAuditEntry } = useApp()
  const { username } = useAuth()

  const [mode, setMode] = useState<"list" | "add" | "edit">("list")
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<RestaurantTable | null>(null)
  const [hardDelete, setHardDelete] = useState(false)

  // Form fields
  const [tableNumber, setTableNumber] = useState("")
  const [capacity, setCapacity] = useState("")
  const [formError, setFormError] = useState("")

  function resetForm() {
    setTableNumber("")
    setCapacity("")
    setFormError("")
    setEditingTable(null)
  }

  function handleAdd() {
    if (!tableNumber || !capacity) {
      setFormError("Preencha todos os campos.")
      return
    }
    const capacityNum = parseInt(capacity)
    if (isNaN(capacityNum) || capacityNum < 1 || capacityNum > 20) {
      setFormError("Capacidade deve ser entre 1 e 20 pessoas.")
      return
    }
    const exists = restaurantTables.find(t => t.number === tableNumber)
    if (exists) {
      setFormError("Ja existe uma mesa com esse numero.")
      return
    }
    const newId = Math.max(...restaurantTables.map(t => t.id), 0) + 1
    addRestaurantTable({
      id: newId,
      number: tableNumber,
      capacity: capacityNum,
      status: "livre",
    })
    addAuditEntry({ user: username || "sistema", action: "Mesa adicionada", reference: `Mesa ${tableNumber} (${capacityNum} pessoas)` })
    resetForm()
    setMode("list")
  }

  function handleEdit() {
    if (!editingTable || !tableNumber || !capacity) return
    const capacityNum = parseInt(capacity)
    if (isNaN(capacityNum) || capacityNum < 1 || capacityNum > 20) {
      setFormError("Capacidade deve ser entre 1 e 20 pessoas.")
      return
    }
    const duplicate = restaurantTables.find(t => t.number === tableNumber && t.id !== editingTable.id)
    if (duplicate) {
      setFormError("Ja existe uma mesa com esse numero.")
      return
    }
    if (editingTable.status === "ocupada") {
      setFormError("Nao e possivel editar uma mesa ocupada.")
      return
    }
    updateRestaurantTable(editingTable.id, { number: tableNumber, capacity: capacityNum })
    addAuditEntry({ user: username || "sistema", action: "Mesa editada", reference: `Mesa ${tableNumber}` })
    resetForm()
    setMode("list")
  }

  function handleDelete(table: RestaurantTable, hard: boolean) {
    if (hard) {
      removeRestaurantTable(table.id)
      addAuditEntry({ user: username || "sistema", action: "Mesa removida", reference: `Mesa ${table.number}` })
    } else {
      updateRestaurantTable(table.id, { status: "livre" })
      addAuditEntry({ user: username || "sistema", action: "Mesa desativada", reference: `Mesa ${table.number}` })
    }
    setDeleteConfirm(null)
    setHardDelete(false)
  }

  function openEdit(table: RestaurantTable) {
    if (table.status === "ocupada") {
      setFormError("Nao e possivel editar uma mesa ocupada.")
      return
    }
    setEditingTable(table)
    setTableNumber(table.number)
    setCapacity(table.capacity.toString())
    setFormError("")
    setMode("edit")
  }

  function openDelete(table: RestaurantTable) {
    if (table.status === "ocupada") {
      setFormError("Nao e possivel excluir uma mesa ocupada.")
      return
    }
    setDeleteConfirm(table)
  }

  const sortedTables = [...restaurantTables].sort((a, b) => {
    const aNum = parseInt(a.number) || 0
    const bNum = parseInt(b.number) || 0
    return aNum - bNum
  })

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      livre: { variant: "default", label: "Livre" },
      ocupada: { variant: "secondary", label: "Ocupada" },
      reservada: { variant: "outline", label: "Reservada" },
    }
    const config = variants[status] || { variant: "outline", label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setMode("list"); resetForm() } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="size-5 text-primary" />
              Gerenciar Mesas
            </DialogTitle>
            <DialogDescription>
              Adicione, edite ou remova mesas do restaurante.
            </DialogDescription>
          </DialogHeader>

          {mode === "list" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <Button
                size="sm" className="gap-1.5 w-fit"
                onClick={() => { resetForm(); setMode("add") }}
              >
                <Plus className="size-4" /> Nova Mesa
              </Button>
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-80 pr-1">
                {sortedTables.map((table) => {
                  const canDelete = table.status !== "ocupada"
                  return (
                    <div
                      key={table.id}
                      className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2.5"
                    >
                      <div className="flex flex-1 items-center gap-3 min-w-0">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">Mesa {table.number}</span>
                            {getStatusBadge(table.status)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Capacidade: {table.capacity} {table.capacity === 1 ? "pessoa" : "pessoas"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm" variant="ghost"
                          className="size-8 p-0"
                          onClick={() => openEdit(table)}
                          disabled={table.status === "ocupada"}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="size-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => openDelete(table)}
                          disabled={!canDelete}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(mode === "add" || mode === "edit") && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="tableNumber">Numero da Mesa</Label>
                <Input
                  id="tableNumber"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  placeholder="Ex: 1, 2, A1, B2..."
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="capacity">Capacidade (pessoas)</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  max="20"
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                  placeholder="Ex: 4"
                />
              </div>
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            {mode === "list" && (
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            )}
            {mode === "add" && (
              <>
                <Button variant="outline" onClick={() => { setMode("list"); resetForm() }}>
                  Cancelar
                </Button>
                <Button onClick={handleAdd}>Adicionar</Button>
              </>
            )}
            {mode === "edit" && (
              <>
                <Button variant="outline" onClick={() => { setMode("list"); resetForm() }}>
                  Cancelar
                </Button>
                <Button onClick={handleEdit}>Salvar</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={v => { if (!v) { setDeleteConfirm(null); setHardDelete(false) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a mesa {deleteConfirm?.number}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="hardDelete"
              checked={hardDelete}
              onCheckedChange={(checked) => setHardDelete(checked === true)}
            />
            <Label htmlFor="hardDelete" className="text-sm cursor-pointer">
              Excluir permanentemente (nao pode ser desfeito)
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHardDelete(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm, hardDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
