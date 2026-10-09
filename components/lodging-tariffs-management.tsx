"use client"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { tariffSchema, type LodgingTariff } from "@/lib/lodging-pricing"
import { businessDay } from "@/lib/utils/business-values"
import { formatCurrency } from "@/lib/utils/formatters"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { LodgingQuotePreview, previewLodging } from "./lodging-quote-preview"

export function LodgingTariffsManagement() {
  const { rooms, lodgingTariffs, saveTariff } = useApp()
  const { can } = useAuth()
  const [form, setForm] = useState<LodgingTariff | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [roomId, setRoomId] = useState("")
  const [guests, setGuests] = useState(1)
  const [start, setStart] = useState(businessDay())
  const [end, setEnd] = useState("")
  const categories = [...new Set(rooms.map(r => r.type))].sort()
  function open(tariff?: LodgingTariff) {
    setEditing(!!tariff); setError("")
    setForm(tariff ?? { id: crypto.randomUUID(), name: "", roomType: categories[0] ?? "", roomId: null, minGuests: 1, maxGuests: 1, pricePerPerson: 120, validFrom: businessDay(), validTo: null, active: true })
  }
  async function save() {
    if (!form || pending) return
    setPending(true); setError("")
    try { await saveTariff(tariffSchema.parse(form), editing); setForm(null) }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar") }
    finally { setPending(false) }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Tarifas por pessoa / noite</h3><p className="text-sm text-muted-foreground">Preço específico do quarto prevalece sobre o da categoria. Reservas mantêm o preço acordado.</p></div>{can("lodgingTariffs.create") && <Button onClick={() => open()}>Nova tarifa</Button>}</div>
    <div className="grid gap-3 md:grid-cols-2">{lodgingTariffs.map(t => <div key={t.id} className="space-y-2 rounded-lg border p-4"><div className="flex items-start justify-between gap-2"><p className="font-medium">{t.name} {!t.active && "· Inativa"}</p>{can("lodgingTariffs.edit") && <Button size="sm" variant="outline" onClick={() => open(t)}>Editar</Button>}</div><p className="text-sm">{t.roomId ? `Quarto ${rooms.find(r => r.id === t.roomId)?.number ?? t.roomId}` : t.roomType} · {t.minGuests} a {t.maxGuests} pessoa(s)</p><p>{formatCurrency(t.pricePerPerson)} / pessoa / noite</p><p className="text-xs text-muted-foreground">De {t.validFrom} até {t.validTo ?? "sem término"}</p></div>)}</div>
    {!lodgingTariffs.length && <p className="text-sm text-muted-foreground">Cadastre as capacidades dos quartos e a primeira tarifa para simular uma hospedagem.</p>}
    <section className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Simular hospedagem</h3><div className="grid gap-3 sm:grid-cols-4">
      <div><Label htmlFor="quote-room">Quarto</Label><select id="quote-room" className="h-11 w-full rounded-md border bg-background px-2" value={roomId} onChange={e => setRoomId(e.target.value)}><option value="">Selecione</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.number} · {r.type}</option>)}</select></div>
      <div><Label htmlFor="quote-guests">Pessoas</Label><Input id="quote-guests" type="number" min={1} max={100} value={guests} onChange={e => setGuests(Number(e.target.value))} /></div>
      <div><Label htmlFor="quote-start">Entrada</Label><Input id="quote-start" type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
      <div><Label htmlFor="quote-end">Saída</Label><Input id="quote-end" type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
    </div><LodgingQuotePreview result={previewLodging(rooms.find(r => r.id === Number(roomId)), lodgingTariffs, guests, start, end)} /></section>
    <Dialog open={!!form} onOpenChange={v => { if (!v && !pending) setForm(null) }}><DialogContent mobileTask protectDraft className="sm:max-w-lg"><DialogHeader><DialogTitle>{editing ? "Editar tarifa" : "Nova tarifa"}</DialogTitle><DialogDescription>Vigência inclui a primeira e a última noite. Faixas sobrepostas no mesmo quarto ou categoria são bloqueadas.</DialogDescription></DialogHeader>
      {form && <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save() }}>
        <div><Label htmlFor="tariff-name">Nome</Label><Input id="tariff-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Standard · duas pessoas" /></div>
        <div><Label htmlFor="tariff-category">Categoria</Label><select id="tariff-category" className="h-11 w-full rounded-md border bg-background px-2" value={form.roomType} onChange={e => setForm({ ...form, roomType: e.target.value, roomId: null })}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><Label htmlFor="tariff-room">Aplicar em</Label><select id="tariff-room" className="h-11 w-full rounded-md border bg-background px-2" value={form.roomId ?? ""} onChange={e => setForm({ ...form, roomId: e.target.value ? Number(e.target.value) : null })}><option value="">Todos os quartos desta categoria</option>{rooms.filter(r => r.type === form.roomType).map(r => <option key={r.id} value={r.id}>Somente quarto {r.number}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="tariff-min">De quantas pessoas</Label><Input id="tariff-min" type="number" min={1} max={100} value={form.minGuests} onChange={e => setForm({ ...form, minGuests: Number(e.target.value) })} /></div><div><Label htmlFor="tariff-max">Até quantas pessoas</Label><Input id="tariff-max" type="number" min={1} max={100} value={form.maxGuests} onChange={e => setForm({ ...form, maxGuests: Number(e.target.value) })} /></div></div>
        <div><Label htmlFor="tariff-price">R$ por pessoa / noite</Label><Input id="tariff-price" type="number" step="0.01" min="0.01" value={form.pricePerPerson} onChange={e => setForm({ ...form, pricePerPerson: Number(e.target.value) })} /></div>
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="tariff-start">A partir de</Label><Input id="tariff-start" type="date" required value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} /></div><div><Label htmlFor="tariff-end">Até (opcional)</Label><Input id="tariff-end" type="date" value={form.validTo ?? ""} onChange={e => setForm({ ...form, validTo: e.target.value || null })} /></div></div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Tarifa ativa</label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar tarifa"}</Button>
      </form>}
    </DialogContent></Dialog>
  </div>
}
