"use client"
import { OriginValues } from "./document-values"
import { sanitizeForAudit } from "@/lib/utils/audit-helpers"
import { PageHeader } from "./page-header"

import { MobileFilters } from "@/components/mobile-filters"
import { useState, useMemo, useEffect, Fragment } from "react"
import { getDataConfig } from "@/lib/data/config"
import { useAuth } from "@/lib/auth-context"
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
import { Search, Filter, ChevronDown, ChevronUp } from "lucide-react"
import type { AuditEntry } from "@/lib/store"

const actionColors: Record<string, string> = {
  Estorno: "bg-warning/15 text-amber-900 dark:text-warning",
  Desconto: "bg-info/15 text-info",
  Cancelamento: "bg-destructive/15 text-destructive",
  "No-show": "bg-destructive/15 text-destructive",
  Desbloqueio: "bg-success/15 text-success",
  Diferenca: "bg-warning/15 text-amber-900 dark:text-warning",
  create: "bg-success/15 text-success",
  update: "bg-info/15 text-info",
  delete: "bg-destructive/15 text-destructive",
}

const operationLabels: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Exclusão",
  action: "Ação",
}

const entityTypeLabels: Record<string, string> = {
  customers: "Pessoas e empresas", suppliers: "Fornecedores", costCenters: "Centros de custo", budgets: "Orçamentos", recurringTransactions: "Recorrências", stays: "Hospedagens", productCategories: "Categorias de bebidas", posProducts: "Bebidas",
  rooms: "Quartos", reservations: "Reservas", consumptions: "Consumos", posSales: "Vendas", restaurantOrders: "Comandas", restaurantTables: "Mesas", stockItems: "Estoque", stockMovements: "Movimentos de estoque", productions: "Produções", employeeConsumptions: "Consumos de funcionários", expenses: "Despesas", transactions: "Transações", accountsReceivable: "Contas a receber", cashCloses: "Caixa", bankTransfers: "Transferências", bankAccounts: "Contas bancárias", users: "Usuários", guests: "Hóspedes", categories: "Categorias", systemSettings: "Configurações", notificationEvents: "Alertas", operationApprovals: "Aprovações", database: "Base de dados",
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
  if (!metadata || !Object.keys(metadata).length) return <p className="text-sm text-muted-foreground">Nenhum detalhe adicional registrado.</p>
  return <div className="rounded-md bg-muted/50 p-3"><OriginValues value={sanitizeForAudit(metadata)} /></div>
}

export function AuditLogTab() {
  const { auditLog: demoLog } = useApp()
  const { user, can } = useAuth()
  const database = getDataConfig().adapter === "database"
  const allowed = can("auditLog.read")
  const identity = JSON.stringify([user?.id, user?.accessVersion, user?.permissions])
  const [remote, setRemote] = useState<{ entries: AuditEntry[]; total: number; users: string[]; entityTypes: string[] }>({ entries: [], total: 0, users: [], entityTypes: [] })
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const auditLog = database ? remote.entries : demoLog
  const [searchTerm, setSearchTerm] = useState("")
  const [filterUser, setFilterUser] = useState<string>("all")
  const [filterOperation, setFilterOperation] = useState<string>("all")
  const [filterEntityType, setFilterEntityType] = useState<string>("all")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!database || !allowed) return
    let disposed = false
    let controller: AbortController | undefined
    const refresh = async () => {
      controller?.abort(); controller = new AbortController()
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), search: searchTerm })
      if (filterUser !== "all") params.set("user", filterUser)
      if (filterOperation !== "all") params.set("operation", filterOperation)
      if (filterEntityType !== "all") params.set("entityType", filterEntityType)
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      try {
        const response = await fetch(`/api/audit?${params}`, { signal: controller.signal, cache: "no-store" })
        if (!response.ok) throw new Error("Consulta indisponível")
        const data = await response.json()
        if (!disposed) { setRemote(data); setError(null) }
      } catch (failure) {
        if (!disposed && !(failure instanceof Error && failure.name === "AbortError")) { setRemote({ entries: [], total: 0, users: [], entityTypes: [] }); setError("Não foi possível consultar o histórico. Verifique o período e seu acesso.") }
      } finally { if (!disposed) setLoading(false) }
    }
    setLoading(true)
    setRemote({ entries: [], total: 0, users: [], entityTypes: [] })
    const delay = setTimeout(() => void refresh(), 300)
    const timer = setInterval(() => { if (!document.hidden) void refresh() }, 15000)
    return () => { disposed = true; controller?.abort(); clearTimeout(delay); clearInterval(timer) }
  }, [database, allowed, identity, page, searchTerm, filterUser, filterOperation, filterEntityType, from, to])

  // Extract unique values for filters
  const uniqueUsers = useMemo(() => {
    const users = new Set(database ? remote.users : auditLog.map(e => e.user))
    return Array.from(users).sort()
  }, [auditLog, database, remote])

  const uniqueOperations = useMemo(() => {
    const ops = new Set(database ? ["create", "update", "delete", "action"] : auditLog.map(e => e.operation).filter((value): value is NonNullable<typeof value> => !!value))
    return Array.from(ops).sort()
  }, [auditLog, database])

  const uniqueEntityTypes = useMemo(() => {
    const types = new Set(database ? remote.entityTypes : auditLog.map(e => e.entityType).filter((value): value is NonNullable<typeof value> => !!value))
    return Array.from(types).sort()
  }, [auditLog, database, remote])

  // Filter and search logic
  const filteredLog = useMemo(() => {
    if (database) return auditLog
    return auditLog.filter(entry => {
      const matchesSearch =
        entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.user.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesUser = filterUser === "all" || entry.user === filterUser
      const matchesOperation = filterOperation === "all" || entry.operation === filterOperation
      const matchesEntityType = filterEntityType === "all" || entry.entityType === filterEntityType

      const day = new Date(entry.date).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
      return matchesSearch && matchesUser && matchesOperation && matchesEntityType && (!from || day >= from) && (!to || day <= to)
    })
  }, [auditLog, searchTerm, filterUser, filterOperation, filterEntityType, database, from, to])

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
    setPage(1); setFrom(""); setTo("")
    setSearchTerm("")
    setFilterUser("all")
    setFilterOperation("all")
    setFilterEntityType("all")
  }

  if (database && !allowed) return <p>Sem acesso ao histórico de auditoria.</p>

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Auditoria" actions={<Badge variant="secondary">{filteredLog.length} de {database ? remote.total : auditLog.length} registros</Badge>} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ação, referência ou usuário..."
                  value={searchTerm}
                  onChange={(e) => { setPage(1); setSearchTerm(e.target.value) }}
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
                  filterEntityType === "all" && from === "" && to === ""
                }
              >
                Limpar
              </Button>
            </div>

            <MobileFilters active={[filterUser !== "all", filterOperation !== "all", filterEntityType !== "all", !!from, !!to].filter(Boolean).length}>
            <div className="grid w-full min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <label className="min-w-0 text-sm">De<Input aria-label="Data inicial" type="date" value={from} onChange={e => { setPage(1); setFrom(e.target.value) }} /></label>
              <label className="min-w-0 text-sm">Até<Input aria-label="Data final" type="date" value={to} onChange={e => { setPage(1); setTo(e.target.value) }} /></label>
              <Select value={filterUser} onValueChange={value => { setPage(1); setFilterUser(value) }}>
                <SelectTrigger aria-label="Filtrar auditoria" className="min-h-11 w-full min-w-0 [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:line-clamp-none">
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

              <Select value={filterOperation} onValueChange={value => { setPage(1); setFilterOperation(value) }}>
                <SelectTrigger className="min-h-11 w-full min-w-0 [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:line-clamp-none">
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

              <Select value={filterEntityType} onValueChange={value => { setPage(1); setFilterEntityType(value) }}>
                <SelectTrigger className="min-h-11 w-full min-w-0 [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:line-clamp-none">
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
            </MobileFilters>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {error && <p role="alert" className="p-4 text-destructive">{error}</p>}
          {loading && <p role="status" className="px-4 py-2 text-sm">Consultando histórico...</p>}
          <div className="md:hidden divide-y">
            {filteredLog.map(entry => <article key={entry.id} className="p-4 space-y-2 break-words">
              <p className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
              <p className="font-semibold">{entry.action}</p>
              <p className="text-sm">{entry.user} · {entry.reference}</p>
              <details><summary className="min-h-11 flex items-center cursor-pointer text-sm">Ver detalhes</summary><MetadataDisplay metadata={entry.metadata} /></details>
            </article>)}
            {!loading && !error && filteredLog.length === 0 && <p className="p-4 text-muted-foreground">Nenhum evento encontrado</p>}
          </div>
          <div className="hidden md:block"><Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Referência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLog.map((entry) => {
                const isExpanded = expandedRows.has(entry.id)
                const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0

                return (
                  <Fragment key={entry.id}>
                    <TableRow className={hasMetadata ? "cursor-pointer hover:bg-muted/50" : ""}>
                      <TableCell>
                        {(
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-11 gap-1 px-2"
                            aria-label={isExpanded ? "Ocultar detalhes" : "Mostrar detalhes"}
                            aria-expanded={isExpanded}
                            onClick={() => toggleRow(entry.id)}
                          >
                            {isExpanded ? "Ocultar" : "Ver detalhes"}
                            {isExpanded ? (
                              <ChevronUp className="size-3" />
                            ) : (
                              <ChevronDown className="size-3" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums font-mono">
                        {new Date(entry.date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs border-transparent ${
                          entry.user === "supervisor"
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-secondary-foreground"
                        }`}>
                          {entry.user}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.operation && (
                          <Badge className={`text-xs border-transparent ${getActionColor("", entry.operation)}`}>
                            {operationLabels[entry.operation] || entry.operation}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.entityType && (
                          <Badge variant="outline" className="text-xs">
                            {entityTypeLabels[entry.entityType] || entry.entityType}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs border-transparent ${getActionColor(entry.action, entry.operation)}`}>
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.reference}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
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
          </Table></div>
          {database && <div className="p-4 flex items-center justify-between gap-2">
            <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Anterior</Button>
            <span className="text-sm">{loading ? "Consultando..." : `Página ${page} de ${Math.max(1, Math.ceil(remote.total / 50))}`}</span>
            <Button variant="outline" disabled={page * 50 >= remote.total || loading} onClick={() => setPage(value => value + 1)}>Próxima</Button>
          </div>}
        </CardContent>
      </Card>
    </div>
  )
}
