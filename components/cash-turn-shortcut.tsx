"use client"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useApp } from "@/lib/app-context"
import { getDataConfig } from "@/lib/data/config"
import { CashSessionPanel, type CashTask } from "./cash-session-panel"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"

export function CashTaskDialog({ task, onClose }: { task: CashTask; onClose: () => void }) {
  const [pending, setPending] = useState(false)
  const title = task === "open" ? "Abrir caixa" : task === "close" ? "Fechar caixa" : "Movimentar caixa"
  return <Dialog open onOpenChange={value => { if (!value && !pending) onClose() }}><DialogContent mobileTask protectDraft busy={pending} className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{task === "close" ? "Confira o dinheiro e prepare a passagem de turno." : "Controle o dinheiro do turno sem perder o atendimento."}</DialogDescription></DialogHeader><CashSessionPanel mode={task} onPendingChange={setPending} onOpened={onClose} /></DialogContent></Dialog>
}

// Convenience opening inside an existing payment/consumption, never a second
// management panel. The full turn operation lives in the Front of House POS.
export function CashTurnShortcut() {
  const { can } = useAuth(), { cashCloses = [] } = useApp()
  const [open, setOpen] = useState(false)
  if (getDataConfig().adapter !== "database" || cashCloses.some(turn => turn.status === "aberto")) return null
  if (!can("cash.open")) return <p className="text-sm text-muted-foreground">Peça a um usuário autorizado para abrir o caixa na Frente de Caixa.</p>
  return <><Button variant="outline" onClick={() => setOpen(true)}>Abrir caixa</Button>{open && <CashTaskDialog task="open" onClose={() => setOpen(false)} />}</>
}
