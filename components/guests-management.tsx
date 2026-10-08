"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Search, Trash2 } from "lucide-react"
import type { GuestProfile } from "@/lib/store"
import { formatCurrency } from "@/lib/utils/formatters"

const emptyGuest: GuestProfile = {
  cpf: "",
  name: "",
  totalStays: 0,
  avgTicket: 0,
  noShows: 0,
}

export function GuestsManagement() {
  const { guests, addGuest, updateGuest, removeGuest, addAuditEntry } = useApp()
  const { username } = useAuth()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCpf, setEditingCpf] = useState<string | null>(null)
  const [form, setForm] = useState<GuestProfile>(emptyGuest)
  const [error, setError] = useState("")

  const filteredGuests = useMemo(() => {
    const term = search.toLowerCase().trim()
    if (!term) return guests
    return guests.filter(guest =>
      guest.name.toLowerCase().includes(term) || guest.cpf.includes(term)
    )
  }, [guests, search])

  function openDialog(guest?: GuestProfile) {
    setEditingCpf(guest?.cpf ?? null)
    setForm(guest ? { ...guest } : emptyGuest)
    setError("")
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingCpf(null)
    setForm(emptyGuest)
    setError("")
  }

  async function handleSave() {
    try {
    const auditUser = username || "sistema"
    const cpf = form.cpf.replace(/\D/g, "")

    if (!form.name.trim() || !cpf) {
      setError("Nome e CPF sao obrigatorios.")
      return
    }

    const { creditValue: _credit, ...editable } = form
    const guestData = {
      ...editable,
      cpf,
      name: form.name.trim(),
      totalStays: Number(form.totalStays) || 0,
      avgTicket: Number(form.avgTicket) || 0,
      noShows: Number(form.noShows) || 0,
    }

    if (editingCpf) {
      await updateGuest(editingCpf, guestData)
      await addAuditEntry({ user: auditUser, action: "Hospede editado", reference: `${guestData.name} (${guestData.cpf})` })
    } else {
      await addGuest(guestData)
      await addAuditEntry({ user: auditUser, action: "Hospede criado", reference: `${guestData.name} (${guestData.cpf})` })
    }
    closeDialog()
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar") }
  }

  async function handleDelete(guest: GuestProfile) {
    if (!confirm(`Excluir hospede "${guest.name}"?`)) return
    await removeGuest(guest.cpf, guest.recordVersion)
    await addAuditEntry({
      user: username || "sistema",
      action: "Hospede removido",
      reference: `${guest.name} (${guest.cpf})`,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome ou CPF" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        <Button onClick={() => openDialog()} className="gap-2"><Plus className="size-4" /> Novo Hospede</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Estadias</TableHead>
                <TableHead>Ticket Medio</TableHead>
                <TableHead>No-shows</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGuests.map(guest => (
                <TableRow key={guest.cpf}>
                  <TableCell className="font-medium">{guest.name}</TableCell>
                  <TableCell>{guest.cpf}</TableCell>
                  <TableCell>{guest.totalStays}</TableCell>
                  <TableCell>{formatCurrency(guest.avgTicket)}</TableCell>
                  <TableCell>{guest.noShows}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openDialog(guest)}><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(guest)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredGuests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum hospede encontrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCpf ? "Editar Hospede" : "Novo Hospede"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <Field label="Nome"><Input value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} /></Field>
            <Field label="CPF"><Input value={form.cpf} disabled={!!editingCpf} onChange={event => setForm(prev => ({ ...prev, cpf: event.target.value }))} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Estadias"><Input type="number" value={form.totalStays} onChange={event => setForm(prev => ({ ...prev, totalStays: Number(event.target.value) }))} /></Field>
              <Field label="Ticket Medio"><Input type="number" value={form.avgTicket} onChange={event => setForm(prev => ({ ...prev, avgTicket: Number(event.target.value) }))} /></Field>
              <Field label="No-shows"><Input type="number" value={form.noShows} onChange={event => setForm(prev => ({ ...prev, noShows: Number(event.target.value) }))} /></Field>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={closeDialog}>Cancelar</Button><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}
