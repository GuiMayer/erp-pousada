"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { Room } from "@/lib/store"

type Props = {
  room: Room
  open: boolean
  onClose: () => void
  onConfirmBlock: (endDate: string, responsible: string, reason: string) => void
  onUnblock: () => void
}

export function BlockRoomModal({ room, open, onClose, onConfirmBlock, onUnblock }: Props) {
  const isBlocked = room.status === "bloqueado"
  const [endDate, setEndDate] = useState(room.blockEndDate || "")
  const [responsible, setResponsible] = useState(room.blockResponsible || "")
  const [reason, setReason] = useState(room.blockReason || "")
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const canSubmit = endDate.trim() !== "" && responsible.trim() !== ""

  function handleConfirm() {
    const newErrors: Record<string, boolean> = {}
    if (!endDate.trim()) newErrors.endDate = true
    if (!responsible.trim()) newErrors.responsible = true
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return
    onConfirmBlock(endDate, responsible, reason)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isBlocked ? `Quarto ${room.number} - Bloqueado` : `Bloquear Quarto ${room.number}`}
          </DialogTitle>
          <DialogDescription>
            {isBlocked
              ? "Detalhes do bloqueio atual. Voce pode desbloquear este quarto."
              : "Informe os dados obrigatorios para bloquear o quarto."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-reason">Motivo</Label>
            <Input
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Reforma do banheiro"
              disabled={isBlocked}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-end-date">
              Data Final Estimada <span className="text-destructive">*</span>
            </Label>
            <Input
              id="block-end-date"
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setErrors(prev => ({ ...prev, endDate: false })) }}
              disabled={isBlocked}
              aria-invalid={errors.endDate}
            />
            {errors.endDate && <p className="text-xs text-destructive">Campo obrigatorio</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-responsible">
              Responsavel <span className="text-destructive">*</span>
            </Label>
            <Input
              id="block-responsible"
              value={responsible}
              onChange={(e) => { setResponsible(e.target.value); setErrors(prev => ({ ...prev, responsible: false })) }}
              placeholder="Nome do responsavel"
              disabled={isBlocked}
              aria-invalid={errors.responsible}
            />
            {errors.responsible && <p className="text-xs text-destructive">Campo obrigatorio</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isBlocked ? (
            <>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button variant="destructive" onClick={onUnblock}>Desbloquear</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={!canSubmit}>Confirmar Bloqueio</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
