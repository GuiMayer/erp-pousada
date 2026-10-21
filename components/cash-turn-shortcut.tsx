"use client"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useApp } from "@/lib/app-context"
import { getDataConfig } from "@/lib/data/config"
import { CashSessionPanel } from "./cash-session-panel"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"

export function CashTurnShortcut() {
  const { can } = useAuth(), { cashCloses = [] } = useApp()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  if (getDataConfig().adapter !== "database" || (!can('cash.open') && !can('cash.close'))) return null
  const active = cashCloses.find(turn => turn.status === 'aberto')
  return <><Button variant="outline" onClick={() => setOpen(true)}>{active ? `Caixa aberto · ${active.operator}` : 'Caixa fechado · Abrir caixa'}</Button>
    <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value) }}><DialogContent mobileTask protectDraft busy={pending} className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Turno de caixa</DialogTitle><DialogDescription>Controle o dinheiro do turno sem sair do atendimento.</DialogDescription></DialogHeader><CashSessionPanel onPendingChange={setPending} /></DialogContent></Dialog>
  </>
}
