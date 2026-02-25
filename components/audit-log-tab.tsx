"use client"

import { useApp } from "@/lib/app-context"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Shield } from "lucide-react"

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
}

const actionColors: Record<string, string> = {
  Estorno: "bg-warning/15 text-warning-foreground",
  Desconto: "bg-info/15 text-info",
  Cancelamento: "bg-destructive/15 text-destructive",
  "No-show": "bg-destructive/15 text-destructive",
  Desbloqueio: "bg-success/15 text-success",
  Diferenca: "bg-warning/15 text-warning-foreground",
}

function getActionColor(action: string) {
  for (const [key, cls] of Object.entries(actionColors)) {
    if (action.includes(key)) return cls
  }
  return "bg-secondary text-secondary-foreground"
}

export function AuditLogTab() {
  const { auditLog } = useApp()

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <Shield className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Log de Auditoria</h2>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acao</TableHead>
                <TableHead>Referencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLog.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs tabular-nums font-mono">{formatDateTime(entry.date)}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] border-transparent ${
                      entry.user === "supervisor"
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-secondary-foreground"
                    }`}>
                      {entry.user}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[11px] border-transparent ${getActionColor(entry.action)}`}>
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.reference}</TableCell>
                </TableRow>
              ))}
              {auditLog.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum evento registrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
