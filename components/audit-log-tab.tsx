"use client"

import { useState, useMemo, Fragment } from "react"
import { useApp } from "@/lib/app-context"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Shield, Search, Filter, ChevronDown, ChevronUp } from "lucide-react"
import { formatDateTime } from "@/lib/utils/formatters"
import type { AuditEntry } from "@/lib/store"

const actionColors: Record<string, string> = {
  Estorno: "bg-warning/15 text-warning-foreground",
  Desconto: "bg-info/15 text-info",
  Cancelamento: "bg-destructive/15 text-destructive",
  "No-show": "bg-destructive/15 text-destructive",
  Desbloqueio: "bg-success/15 text-success",
  Diferenca: "bg-warning/15 text-warning-foreground",
  create: "bg-success/15 text-success",
  update: "bg-info/15 text-info",
  delete: "bg-destructive/15 text-destructive",
}

const operationLabels: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Exclusão",
}

const entityTypeLabels: Record<string, string> = {
  Transaction: "Transação",
  Expense: "Despesa",
  GuestProfile: "Hóspede",
  StockItem: "Item de Estoque",
  StockMovement: "Movimentação",
  ExpenseCategory: "Categoria",
  Production: "Produção",
  Reservation: "Reserva",
}

function getActionColor(action: string, operation?: string) {
  if (operation && actionColors[operation]) {
    return actionColors[operation]
  }
  for (const [key, cls] of Object.entries(actionColors)) {
    if (action.includes(key)) return cls
  }
  return "bg-secondary text-secondary-foreground"
}

function MetadataDisplay({ metadata }: { metadata?: AuditEntry["metadata"] }) {
  if (!metadata) return null

  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return "—"
    if (typeof value === "object") return JSON.stringify(value, null, 2)
    return String(value)
  }

  return (
    <div className="text-xs space-y-2 p-3 bg-muted/50 rounded-md">
      {metadata.before && (
        <div>
          <div className="font-semibold text-muted-foreground mb-1">Antes:</div>
          <pre className="text-[10px] overflow-x-auto">
            {JSON.stringify(metadata.before, null, 2)}
          </pre>
        </div>
      )}
      {metadata.after && (
        <div>
          <div className="font-semibold text-muted-foreground mb-1">Depois:</div>
          <pre className="text-[10px] overflow-x-auto">
            {JSON.stringify(metadata.after, null, 2)}
          </pre>
        </div>
      )}
      {metadata.reason && (
        <div>
          <span className="font-semibold text-muted-foreground">Motivo:</span>{" "}
          {metadata.reason}
        </div>
      )}
      {metadata.amount !== undefined && (
        <div>
          <span className="font-semibold text-muted-foreground">Valor:</span>{" "}
          R$ {metadata.amount.toFixed(2)}
        </div>
      )}
    </div>
  )
}

export function AuditLogTab() {
  const { auditLog } = useApp()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterUser, setFilterUser] = useState<string>("all")
  const [filterOperation, setFilterOperation] = useState<string>("all")
  const [filterEntityType, setFilterEntityType] = useState<string>("all")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Extract unique values for filters
  const uniqueUsers = useMemo(() => {
    const users = new Set(auditLog.map(e => e.user))
    return Array.from(users).sort()
  }, [auditLog])

  const uniqueOperations = useMemo(() => {
    const ops = new Set(auditLog.map(e => e.operation).filter((value): value is NonNullable<typeof value> => !!value))
    return Array.from(ops).sort()
  }, [auditLog])

  const uniqueEntityTypes = useMemo(() => {
    const types = new Set(auditLog.map(e => e.entityType).filter((value): value is NonNullable<typeof value> => !!value))
    return Array.from(types).sort()
  }, [auditLog])

  // Filter and search logic
  const filteredLog = useMemo(() => {
    return auditLog.filter(entry => {
      const matchesSearch =
        entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.user.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesUser = filterUser === "all" || entry.user === filterUser
      const matchesOperation = filterOperation === "all" || entry.operation === filterOperation
      const matchesEntityType = filterEntityType === "all" || entry.entityType === filterEntityType

      return matchesSearch && matchesUser && matchesOperation && matchesEntityType
    })
  }, [auditLog, searchTerm, filterUser, filterOperation, filterEntityType])

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const clearFilters = () => {
    setSearchTerm("")
    setFilterUser("all")
    setFilterOperation("all")
    setFilterEntityType("all")
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <Shield className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Log de Auditoria</h2>
        <Badge variant="secondary" className="ml-auto">
          {filteredLog.length} de {auditLog.length} registros
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ação, referência ou usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={
                  searchTerm === "" &&
                  filterUser === "all" &&
                  filterOperation === "all" &&
                  filterEntityType === "all"
                }
              >
                Limpar
              </Button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="size-3 mr-2" />
                  <SelectValue placeholder="Usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  {uniqueUsers.map(user => (
                    <SelectItem key={user} value={user}>{user}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterOperation} onValueChange={setFilterOperation}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="size-3 mr-2" />
                  <SelectValue placeholder="Operação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as operações</SelectItem>
                  {uniqueOperations.map(op => (
                    <SelectItem key={op} value={op}>
                      {operationLabels[op] || op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="size-3 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {uniqueEntityTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {entityTypeLabels[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Acao</TableHead>
                <TableHead>Referencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLog.map((entry) => {
                const isExpanded = expandedRows.has(entry.id)
                const hasMetadata = entry.metadata &&
                  (entry.metadata.before || entry.metadata.after || entry.metadata.reason || entry.metadata.amount !== undefined)

                return (
                  <Fragment key={entry.id}>
                    <TableRow className={hasMetadata ? "cursor-pointer hover:bg-muted/50" : ""}>
                      <TableCell>
                        {hasMetadata && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleRow(entry.id)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="size-3" />
                            ) : (
                              <ChevronDown className="size-3" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums font-mono">
                        {formatDateTime(entry.date)}
                      </TableCell>
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
                        {entry.operation && (
                          <Badge className={`text-[10px] border-transparent ${getActionColor("", entry.operation)}`}>
                            {operationLabels[entry.operation] || entry.operation}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.entityType && (
                          <Badge variant="outline" className="text-[10px]">
                            {entityTypeLabels[entry.entityType] || entry.entityType}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[11px] border-transparent ${getActionColor(entry.action, entry.operation)}`}>
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.reference}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasMetadata && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <MetadataDisplay metadata={entry.metadata} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
              {filteredLog.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {auditLog.length === 0
                      ? "Nenhum evento registrado"
                      : "Nenhum evento encontrado com os filtros aplicados"}
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
