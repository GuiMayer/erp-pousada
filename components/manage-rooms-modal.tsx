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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Plus, Pencil, Trash2, BedDouble } from "lucide-react"
import type { Room, RoomStatus } from "@/lib/store"

function generateTimeline(status: RoomStatus) {
  const days = []
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    days.push({
      date: d.toISOString().split("T")[0],
      label: `${d.getDate()} ${months[d.getMonth()]}`,
      status,
    })
  }
  return days
}

const ROOM_TYPES = ["Standard", "Luxo", "Suite", "Suite Master"]

type Props = {
  open: boolean
  onClose: () => void
}

export function ManageRoomsModal({ open, onClose }: Props) {
  const { rooms, addRoom, updateRoom, removeRoom, addAuditEntry } = useApp()
  const { username, isSupervisor } = useAuth()

  const [mode, setMode] = useState<"list" | "add" | "edit">("list")
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Room | null>(null)

  // Form fields
  const [roomNumber, setRoomNumber] = useState("")
  const [roomType, setRoomType] = useState("")
  const [formError, setFormError] = useState("")

  function resetForm() {
    setRoomNumber("")
    setRoomType("")
    setFormError("")
    setEditingRoom(null)
  }

  function handleAdd() {
    if (!roomNumber || !roomType) {
      setFormError("Preencha todos os campos.")
      return
    }
    const exists = rooms.find(r => r.number === roomNumber)
    if (exists) {
      setFormError("Ja existe um quarto com esse numero.")
      return
    }
    const newId = Math.max(...rooms.map(r => r.id), 0) + 1
    addRoom({
      id: newId,
      number: roomNumber,
      type: roomType,
      status: "disponivel",
      timeline: generateTimeline("disponivel"),
    })
    addAuditEntry({ user: username || "sistema", action: "Quarto adicionado", reference: `Quarto ${roomNumber} (${roomType})` })
    resetForm()
    setMode("list")
  }

  function handleEdit() {
    if (!editingRoom || !roomNumber || !roomType) return
    const duplicate = rooms.find(r => r.number === roomNumber && r.id !== editingRoom.id)
    if (duplicate) {
      setFormError("Ja existe um quarto com esse numero.")
      return
    }
    updateRoom(editingRoom.id, { number: roomNumber, type: roomType })
    addAuditEntry({ user: username || "sistema", action: "Quarto editado", reference: `Quarto ${roomNumber}` })
    resetForm()
    setMode("list")
  }

  function handleDelete(room: Room) {
    removeRoom(room.id)
    addAuditEntry({ user: username || "sistema", action: "Quarto removido", reference: `Quarto ${room.number}` })
    setDeleteConfirm(null)
  }

  function openEdit(room: Room) {
    setEditingRoom(room)
    setRoomNumber(room.number)
    setRoomType(room.type)
    setFormError("")
    setMode("edit")
  }

  const sortedRooms = [...rooms].sort((a, b) => a.number.localeCompare(b.number))

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setMode("list"); resetForm() } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BedDouble className="size-5 text-primary" />
              Gerenciar Quartos
            </DialogTitle>
            <DialogDescription>
              Adicione, edite ou remova quartos da pousada.
            </DialogDescription>
          </DialogHeader>

          {mode === "list" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <Button
                size="sm" className="gap-1.5 w-fit"
                onClick={() => { resetForm(); setMode("add") }}
              >
                <Plus className="size-4" /> Novo Quarto
              </Button>
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-80 pr-1">
                {sortedRooms.map((room) => {
                  const canDelete = room.status === "disponivel"
                  return (
                    <div
                      key={room.id}
                      className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2.5"
                    >
                      <div className="flex flex-1 items-center gap-3 min-w-0">
                        <span className="text-sm font-bold tabular-nums text-foreground">{room.number}</span>
                        <Badge className="bg-muted text-muted-foreground border-transparent text-[10px]">
                          {room.type}
                        </Badge>
                        <Badge className={`text-[10px] border-transparent ${
                          room.status === "disponivel" ? "bg-success/15 text-success" :
                          room.status === "ocupado" ? "bg-warning/15 text-warning-foreground" :
                          room.status === "limpeza" ? "bg-cleaning/15 text-cleaning" :
                          "bg-info/15 text-info"
                        }`}>
                          {room.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(room)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        {isSupervisor && (
                          <Button
                            variant="ghost" size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            disabled={!canDelete}
                            title={canDelete ? "Remover quarto" : "So e possivel remover quartos disponiveis"}
                            onClick={() => setDeleteConfirm(room)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(mode === "add" || mode === "edit") && (
            <div className="flex flex-col gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Numero do Quarto</Label>
                  <Input
                    value={roomNumber}
                    onChange={e => { setRoomNumber(e.target.value); setFormError("") }}
                    placeholder="Ex: 101"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Tipo</Label>
                  <Select value={roomType} onValueChange={v => { setRoomType(v); setFormError("") }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROOM_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setMode("list"); resetForm() }}>Voltar</Button>
                <Button onClick={mode === "add" ? handleAdd : handleEdit} disabled={!roomNumber || !roomType}>
                  {mode === "add" ? "Adicionar" : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={v => { if (!v) setDeleteConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Quarto {deleteConfirm?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa acao nao pode ser desfeita. O quarto sera removido permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
