"use client"
import { TransactionCheck } from "./transaction-check"
import { PermissionGate } from "@/components/permission-gate"

import { getDataConfig } from "@/lib/data/config"
import { validateSupervisorPasswordAsync } from "@/lib/utils/validators"

import { CashSessionPanel } from "./cash-session-panel"
import { PaymentDialog } from "./payment-fields"
import { businessDay } from "@/lib/utils/business-values"
import { useState, useMemo } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Separator } from "@/components/ui/separator"
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Plus, Undo2, Lock, CalendarDays, Clock, User,
  CreditCard, FileText, Tag, Eye,
} from "lucide-react"
import type { Transaction, Expense } from "@/lib/store"
import { formatCurrency, daysUntilDue } from "@/lib/utils/formatters"
import { generateInstallments } from "@/lib/utils/installment-generator"
import { SuppliersManagement } from "@/components/suppliers-management"
import { AccountsReceivableManagement } from "@/components/accounts-receivable-management"
import CustomersManagement from "@/components/customers-management"
import { FinancialCadastrosManagement } from "@/components/financial-cadastros-management"
import { GuestsManagement } from "@/components/guests-management"

function formatDateBR(iso: string) {
  const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00")
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

const movementLabels: Record<Transaction["type"], string> = { receita: "Receita", despesa: "Despesa", estorno: "Estorno", credito_concedido: "Crédito concedido", credito_utilizado: "Crédito utilizado", transferencia_entrada: "Transferência recebida", transferencia_saida: "Transferência enviada" }
const movementSign = (type: Transaction["type"]) => ["receita", "credito_concedido", "transferencia_entrada"].includes(type) ? "+" : "-"
const movementClass = (type: Transaction["type"]) => type === "receita" ? "text-success" : type === "despesa" ? "text-destructive" : "text-muted-foreground"

type DueFilter = "todos" | "pendentes" | "pagos" | "vencidos"

export function FinancialTab() {
  const {
    expenses, transactions, categories, cashCloses, reservations, updateReservation,
    runOperation, discountCeiling, addExpense, updateExpense, markInstallmentAsPaid, addTransaction,
    addAuditEntry, addCategory, addCashClose, setDiscountCeiling,
  } = useApp()
  const { isSupervisor, username, can } = useAuth()
  const financialTabs: Record<string, string[]> = { vencimentos: ["expenses.read"], transacoes: ["transactions.read"], fornecedores: ["suppliers.read"], clientes: ["customers.read"], hospedes: ["guests.read"], "contas-receber": ["accountsReceivable.read"], cadastros: ["bankAccounts.read", "categories.read", "costCenters.read"], "fechar-turno": ["cash.open", "cash.close"] }
  const visible = (tab: string) => financialTabs[tab]?.some(can)

  // New expense modal
  const [showNewExpense, setShowNewExpense] = useState(false)
  const [savingExpense, setSavingExpense] = useState(false), [expenseError, setExpenseError] = useState("")
  const [expDesc, setExpDesc] = useState("")
  const [expCategory, setExpCategory] = useState("")
  const [expValue, setExpValue] = useState("")
  const [expDueDate, setExpDueDate] = useState("")
  const [expInstallments, setExpInstallments] = useState("1")
  const [expInstallmentInterval, setExpInstallmentInterval] = useState("30")
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState("")

  // Refund modal
  const [refundModal, setRefundModal] = useState<Transaction | null>(null)
  const [supervisorPass, setSupervisorPass] = useState("")
  const [refundError, setRefundError] = useState("")

  // Discount modal
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent")
  const [discountValue, setDiscountValue] = useState("")
  const [discountUnlockPass, setDiscountUnlockPass] = useState("")
  const [discountUnlocked, setDiscountUnlocked] = useState(false)
  const [discountReservationId, setDiscountReservationId] = useState("")
  const [discountError, setDiscountError] = useState("")

  const [payingExpense, setPayingExpense] = useState<(ExpenseRow & { recordVersion?: number }) | null>(null)
  // Due filter (toggle group)
  const [dueFilter, setDueFilter] = useState<DueFilter>("todos")

  // Date range filter
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Transaction detail sheet
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null)

  // Transaction type filter
  const [txTypeFilter, setTxTypeFilter] = useState<string>("todos")

  const totalReceitas = transactions.filter(t => t.type === "receita").reduce((a, t) => a + t.value, 0)
  const totalDespesas = transactions.filter(t => t.type === "despesa").reduce((a, t) => a + t.value, 0)
  const totalEstornos = transactions.filter(t => t.type === "estorno").reduce((a, t) => a + Math.abs(t.value), 0)
  const netResult = totalReceitas - totalDespesas - totalEstornos

  const todayISO = businessDay()

  // Expand expenses with installments into individual rows
  type ExpenseRow = {
    id: string
    description: string
    category: string
    value: number
    paidValue?:number
    dueDate: string
    paid: boolean
    expenseId: string
    installmentId?: string
    installmentNumber?: number
    totalInstallments?: number
  }

  const expandedExpenses = useMemo(() => {
    const rows: ExpenseRow[] = []

    expenses.forEach(expense => {
      if (expense.installments && expense.installments.length > 0) {
        // Expand each installment as a separate row
        expense.installments.forEach(installment => {
          rows.push({
            id: `${expense.id}-${installment.id}`,
            description: expense.description,
            category: expense.category,
            value: installment.value,paidValue:installment.paidValue??0,
            dueDate: installment.dueDate,
            paid: installment.paid,
            expenseId: expense.id,
            installmentId: installment.id,
            installmentNumber: installment.installmentNumber,
            totalInstallments: expense.installments!.length
          })
        })
      } else {
        // Single expense without installments
        rows.push({
          id: expense.id,
          description: expense.description,
          category: expense.category,
          value: expense.value,paidValue:expense.paidValue??0,
          dueDate: expense.dueDate,
          paid: expense.paid,
          expenseId: expense.id
        })
      }
    })

    return rows
  }, [expenses])

  // Filtered expenses based on toggle group
  const filteredExpenses = useMemo(() => {
    let result = [...expandedExpenses]
    switch (dueFilter) {
      case "pendentes":
        result = result.filter(e => !e.paid && daysUntilDue(e.dueDate) >= 0)
        break
      case "pagos":
        result = result.filter(e => e.paid)
        break
      case "vencidos":
        result = result.filter(e => !e.paid && daysUntilDue(e.dueDate) < 0)
        break
    }
    return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [expandedExpenses, dueFilter])

  // Filtered transactions based on date range and type
  const filteredTransactions = useMemo(() => {
    let result = [...transactions]
    if (txTypeFilter !== "todos") {
      result = result.filter(t => t.type === txTypeFilter)
    }
    if (dateFrom) {
      result = result.filter(t => businessDay(t.date) >= dateFrom)
    }
    if (dateTo) {
      result = result.filter(t => businessDay(t.date) <= dateTo)
    }
    return result.sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, dateFrom, dateTo, txTypeFilter])

  async function handleCreateExpense() {
    if (savingExpense || !expDesc || !expCategory || !expValue || !expDueDate) return

    const totalValue = Number(expValue)
    const numInstallments = Number(expInstallments)
    const intervalDays = Number(expInstallmentInterval)

    // Generate installments if more than 1
    const installments = numInstallments > 1
      ? generateInstallments({
          totalValue,
          numberOfInstallments: numInstallments,
          firstDueDate: expDueDate,
          intervalDays
        })
      : undefined

    const e = {
      id: crypto.randomUUID(),
      description: expDesc,
      category: expCategory,
      value: totalValue,
      dueDate: expDueDate,
      paid: false,
      installments,
    }
    setSavingExpense(true); setExpenseError("")
    try { await addExpense(e)
    setExpDesc(""); setExpCategory(""); setExpValue(""); setExpDueDate("")
    setExpInstallments("1"); setExpInstallmentInterval("30")
    setShowNewExpense(false)
    } catch (error) { setExpenseError(error instanceof Error ? error.message : "Despesa não salva") }
    finally { setSavingExpense(false) }
  }

  async function handleMarkPaid(expenseRow: ExpenseRow) {
    if (expenseRow.paid) return
    if (getDataConfig().adapter === "database") {
      try { setPayingExpense({ ...expenseRow, recordVersion: expenses.find(item => item.id === expenseRow.expenseId)?.recordVersion }) }
      catch (error) { alert(error instanceof Error ? error.message : "Pagamento não concluído") }
      return
    }

    if (expenseRow.installmentId) {
      // Mark individual installment as paid
      await markInstallmentAsPaid(expenseRow.expenseId, expenseRow.installmentId)
    } else {
      // Mark entire expense as paid (legacy single expense)
      await updateExpense(expenseRow.expenseId, {
        paid: true,
        paymentDate: todayISO,
      })
    }

    await addTransaction({
      id: `T${String(transactions.length + 1).padStart(3, "0")}`,
      date: todayISO,
      description: expenseRow.installmentNumber
        ? `Pagamento ${expenseRow.description} (${expenseRow.installmentNumber}/${expenseRow.totalInstallments})`
        : `Pagamento ${expenseRow.description}`,
      value: expenseRow.value,
      type: "despesa",
      refId: expenseRow.id,
      category: expenseRow.category,
      responsible: username || "operador",
    })

    addAuditEntry({
      user: username || "sistema",
      action: "Pagamento registrado",
      reference: expenseRow.installmentNumber
        ? `${expenseRow.expenseId} - ${expenseRow.description} (${expenseRow.installmentNumber}/${expenseRow.totalInstallments})`
        : `${expenseRow.expenseId} - ${expenseRow.description}`,
    })
  }

  async function handleRefund() {
    if (!refundModal) return
    if (getDataConfig().adapter === "demo-localStorage" && !await validateSupervisorPasswordAsync(supervisorPass)) {
      setRefundError("Senha de supervisor incorreta")
      return
    }
    if (getDataConfig().adapter === "database") {
      try { await runOperation("refund-transaction", { transactionId: refundModal.id }); setRefundModal(null); setSupervisorPass("") }
      catch (error) { setRefundError(error instanceof Error ? error.message : "Estorno não concluído") }
      return
    }
    await addTransaction({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split("T")[0],
      description: `Estorno: ${refundModal.description}`,
      value: Math.abs(refundModal.value),
      type: "estorno",
      refId: refundModal.id,
      responsible: username || "supervisor",
    })
    addAuditEntry({
      user: username || "sistema",
      action: "Estorno realizado",
      reference: `${refundModal.id} - ${refundModal.description}`,
    })
    setRefundModal(null)
    setSupervisorPass("")
    setRefundError("")
  }

  function handleAddCategory() {
    if (!newCategoryLabel) return
    addCategory(newCategoryLabel)
    setNewCategoryLabel("")
    setShowNewCategory(false)
  }

  async function handleDiscountCheck() {
    const reservation = reservations.find(r => r.id === discountReservationId)
    if (!reservation) return
    try {
      const value = Number(discountValue)
      if (!Number.isFinite(value) || value <= 0 || discountType === "percent" && value > 100) throw new Error("Desconto inválido")
      if (getDataConfig().adapter === "database") await runOperation("reservation-discount", { reservationId: reservation.id, type: discountType, value })
      else {
        const amount = discountType === "percent" ? reservation.totalValue * value / 100 : value
        if (amount > reservation.totalValue) throw new Error("Desconto excede o valor da reserva")
        await updateReservation(reservation.id, { totalValue: reservation.totalValue - amount })
      }
      setShowDiscountModal(false); setDiscountValue(""); setDiscountUnlockPass(""); setDiscountUnlocked(false); setDiscountError("")
    } catch (error) { setDiscountError(error instanceof Error ? error.message : "Desconto não aplicado") }
  }

  const discountNeedsSupervisor =
    getDataConfig().adapter === "demo-localStorage" && !isSupervisor && (discountType === "percent" ? Number(discountValue) : Number(discountValue) / (reservations.find(r => r.id === discountReservationId)?.totalValue || 1) * 100) > discountCeiling

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h2 className="hidden sm:block text-lg font-semibold text-foreground">Financeiro</h2>
      <p className="text-xs text-muted-foreground">Saldos internos. Confira os movimentos com seu extrato bancário. Cartões usam registro simplificado; taxas e repasses não são conciliados automaticamente.</p>

      {can("transactions.read") && <details className="mobile-summary-toggle sm:hidden"><summary>Resumo financeiro</summary><p className="py-2 text-sm">Receitas: {formatCurrency(totalReceitas)} · Despesas: {formatCurrency(totalDespesas)} · Líquido: {formatCurrency(netResult)}</p></details>}
      {/* Summary cards */}
      {can("transactions.read") && <div className="financial-summary grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Receitas" value={totalReceitas} icon={<TrendingUp className="size-4" />} variant="success" />
        <SummaryCard label="Despesas" value={totalDespesas} icon={<TrendingDown className="size-4" />} variant="destructive" />
        <SummaryCard label="Estornos" value={totalEstornos} icon={<Undo2 className="size-4" />} variant="warning" />
        {can("transactions.read") && (
          <SummaryCard label="Liquido" value={netResult} icon={<DollarSign className="size-4" />} variant="primary" />
        )}
      </div>}

      <Tabs defaultValue={Object.keys(financialTabs).find(visible)}>
        <TabsList mobilePriority={["vencimentos", "contas-receber", "transacoes"]}>
          {visible("vencimentos") && (<TabsTrigger value="vencimentos">Vencimentos</TabsTrigger>)}
          {visible("transacoes") && (<TabsTrigger value="transacoes">Transacoes</TabsTrigger>)}
          {visible("fornecedores") && (<TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>)}
          {visible("clientes") && (<TabsTrigger value="clientes">Clientes</TabsTrigger>)}
          {visible("hospedes") && (<TabsTrigger value="hospedes">Hospedes</TabsTrigger>)}
          {visible("contas-receber") && (<TabsTrigger value="contas-receber">Contas a Receber</TabsTrigger>)}
          {visible("cadastros") && (<TabsTrigger value="cadastros">Cadastros</TabsTrigger>)}
          {visible("fechar-turno") && (<TabsTrigger value="fechar-turno">Fechar Turno</TabsTrigger>)}
        </TabsList>

        {/* Upcoming payments */}
        {visible("vencimentos") && (<TabsContent value="vencimentos">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">Vencimentos</h3>
              <PermissionGate permission="expenses.create"><Button size="sm" className="gap-1.5" onClick={() => setShowNewExpense(true)}>
                <Plus className="size-4" /> Nova Despesa
              </Button></PermissionGate>
            </div>

            {/* Toggle group filter */}
            <ToggleGroup
              type="single"
              value={dueFilter}
              onValueChange={(v) => { if (v) setDueFilter(v as DueFilter) }}
              className="justify-start"
            >
              <ToggleGroupItem value="todos" className="text-xs gap-1.5">
                Todos
                <Badge className="bg-secondary text-secondary-foreground border-transparent text-[10px] ml-1">{expandedExpenses.length}</Badge>
              </ToggleGroupItem>
              <ToggleGroupItem value="pendentes" className="text-xs gap-1.5">
                Pendentes
                <Badge className="bg-warning/15 text-warning-foreground border-transparent text-[10px] ml-1">
                  {expandedExpenses.filter(e => !e.paid && daysUntilDue(e.dueDate) >= 0).length}
                </Badge>
              </ToggleGroupItem>
              <ToggleGroupItem value="pagos" className="text-xs gap-1.5">
                Pagos
                <Badge className="bg-success/15 text-success border-transparent text-[10px] ml-1">
                  {expandedExpenses.filter(e => e.paid).length}
                </Badge>
              </ToggleGroupItem>
              <ToggleGroupItem value="vencidos" className="text-xs gap-1.5">
                Vencidos
                <Badge className="bg-destructive/15 text-destructive border-transparent text-[10px] ml-1">
                  {expandedExpenses.filter(e => !e.paid && daysUntilDue(e.dueDate) < 0).length}
                </Badge>
              </ToggleGroupItem>
            </ToggleGroup>

            <Card>
              <CardContent className="p-0">
                <Table mobilePreview={["Descrição", "Valor", "Vencimento", "Status"]} mobileColumns={["Descrição", "Categoria", "Valor", "Vencimento", "Status", "Ação"]}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acao</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((e) => {
                      const days = daysUntilDue(e.dueDate)
                      const isUrgent = days <= 3 && days >= 0
                      const isOverdue = days < 0
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">
                            {e.description}
                            {e.installmentNumber && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({e.installmentNumber}/{e.totalInstallments})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{e.category}</TableCell>
                          <TableCell className="tabular-nums text-xs">{formatCurrency(e.value)}</TableCell>
                          <TableCell className="text-xs">{formatDateBR(e.dueDate)}</TableCell>
                          <TableCell>
                            {e.paid ? (
                              <Badge className="bg-success/15 text-success border-transparent text-[10px]">Pago</Badge>
                            ) : isOverdue ? (
                              <Badge className="bg-destructive text-destructive-foreground border-transparent text-[10px] gap-1">
                                <AlertTriangle className="size-3" /> Vencido
                              </Badge>
                            ) : isUrgent ? (
                              <Badge className="animate-pulse-alert bg-destructive/15 text-destructive border-transparent text-[10px] gap-1">
                                <AlertTriangle className="size-3" /> {days}d
                              </Badge>
                            ) : (
                              <Badge className="bg-secondary text-secondary-foreground border-transparent text-[10px]">
                                {days}d
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!e.paid && (
                              <Button
                                variant="ghost" size="sm"
                                className="text-xs text-success hover:text-success gap-1"
                                onClick={() => handleMarkPaid(e)}
                              >
                                Pagar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {filteredExpenses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          Nenhum vencimento encontrado para este filtro
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>)}

        {/* Transactions */}
        {visible("transacoes") && (<TabsContent value="transacoes">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">Historico de Transacoes</h3>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowDiscountModal(true)}>
                Aplicar Desconto
              </Button>
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo</Label>
                <ToggleGroup
                  type="single" value={txTypeFilter}
                  onValueChange={v => { if (v) setTxTypeFilter(v) }}
                >
                  <ToggleGroupItem value="todos" className="text-xs">Todos</ToggleGroupItem>
                  <ToggleGroupItem value="receita" className="text-xs">Receitas</ToggleGroupItem>
                  <ToggleGroupItem value="despesa" className="text-xs">Despesas</ToggleGroupItem>
                  <ToggleGroupItem value="estorno" className="text-xs">Estornos</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Periodo</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date" value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="h-9 w-36 text-xs"
                    placeholder="De"
                  />
                  <span className="text-xs text-muted-foreground">ate</span>
                  <Input
                    type="date" value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="h-9 w-36 text-xs"
                    placeholder="Ate"
                  />
                  {(dateFrom || dateTo) && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDateFrom(""); setDateTo("") }}>
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table mobilePreview={["Descrição", "Valor", "Data", "Tipo"]} mobileColumns={["ID", "Data", "Descrição", "Valor", "Tipo", "Ações"]}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Tipo</TableHead>
                      {can("transactions.refund") && <TableHead className="text-right">Acoes</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((t) => (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => setDetailTransaction(t)}
                      >
                        <TableCell className="font-mono text-xs">{t.id}</TableCell>
                        <TableCell className="text-xs">{formatDateBR(t.date)}</TableCell>
                        <TableCell className="font-medium text-sm">{t.description}</TableCell>
                        <TableCell className={`tabular-nums text-xs font-semibold ${
                          movementClass(t.type)
                        }`}>
                          {movementSign(t.type)}{formatCurrency(Math.abs(t.value))}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border-transparent ${
                            t.type === "receita" ? "bg-success/15 text-success" :
                            t.type === "estorno" ? "bg-warning/15 text-warning-foreground" :
                            "bg-secondary text-muted-foreground"
                          }`}>
                            {movementLabels[t.type]}
                          </Badge>
                        </TableCell>
                        {can("transactions.refund") && (
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            {t.type === "receita" && !t.originType && !/^(Venda|Comanda|Consumo quarto|Hospedagem|Recebimento) /.test(t.refId ?? "") && (
                              <Button
                                variant="ghost" size="sm"
                                className="gap-1 text-xs text-warning-foreground hover:text-warning-foreground"
                                onClick={() => { setRefundModal(t); setSupervisorPass(""); setRefundError("") }}
                              >
                                <Undo2 className="size-3.5" /> Estornar
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={can("transactions.refund") ? 6 : 5} className="py-8 text-center text-muted-foreground">
                          Nenhuma transacao encontrada para os filtros selecionados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              {filteredTransactions.length} transacao(oes) encontrada(s)
            </p>
          </div>
        </TabsContent>)}

        {/* Suppliers */}
        {visible("fornecedores") && (<TabsContent value="fornecedores">
          <SuppliersManagement />
        </TabsContent>)}

        {/* Customers */}
        {visible("clientes") && (<TabsContent value="clientes">
          <CustomersManagement />
        </TabsContent>)}

        {visible("hospedes") && (<TabsContent value="hospedes">
          <GuestsManagement />
        </TabsContent>)}

        {/* Accounts Receivable */}
        {visible("contas-receber") && (<TabsContent value="contas-receber">
          <AccountsReceivableManagement />
        </TabsContent>)}

        {visible("cadastros") && (<TabsContent value="cadastros">
          <FinancialCadastrosManagement />
        </TabsContent>)}

        {/* Cash close */}
        {visible("fechar-turno") && (<TabsContent value="fechar-turno"><CashSessionPanel /></TabsContent>)}
      </Tabs>

      {/* Transaction detail sheet */}
      <Sheet open={!!detailTransaction} onOpenChange={v => { if (!v) setDetailTransaction(null) }}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {detailTransaction && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Eye className="size-5 text-primary" />
                  Transacao {detailTransaction.id}
                </SheetTitle>
                <SheetDescription>Detalhes completos da movimentacao</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-5 py-6">
                <Badge className={`w-fit text-xs border-transparent ${
                  detailTransaction.type === "receita" ? "bg-success/15 text-success" :
                  detailTransaction.type === "estorno" ? "bg-warning/15 text-warning-foreground" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  {movementLabels[detailTransaction.type]}
                </Badge>

                <div className="flex flex-col gap-3">
                  <TxDetailRow icon={<FileText className="size-4" />} label="Descricao" value={detailTransaction.description} />
                  <TxDetailRow icon={<DollarSign className="size-4" />} label="Valor" value={
                    `${movementSign(detailTransaction.type)} ${formatCurrency(Math.abs(detailTransaction.value))}`
                  } />
                  <TxDetailRow icon={<CalendarDays className="size-4" />} label="Data" value={formatDateBR(detailTransaction.date)} />
                  <Separator />
                  <TxDetailRow icon={<Tag className="size-4" />} label="Categoria" value={detailTransaction.category || "Nao informada"} />
                  <TxDetailRow icon={<CreditCard className="size-4" />} label="Meio de Pagamento" value={detailTransaction.paymentMethod || "Nao informado"} />
                  <TxDetailRow icon={<User className="size-4" />} label="Responsavel" value={detailTransaction.responsible || "Nao informado"} />
                  {detailTransaction.notes && (
                    <>
                      <Separator />
                      <TxDetailRow icon={<Clock className="size-4" />} label="Observacoes" value={detailTransaction.notes} />
                    </>
                  )}
                  {getDataConfig().adapter === "database" && <TransactionCheck key={detailTransaction.id} transaction={detailTransaction} onDone={() => setDetailTransaction(null)} />}
                  {detailTransaction.refId && (
                    <TxDetailRow icon={<Undo2 className="size-4" />} label="Ref. Original" value={detailTransaction.refId} />
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* New expense modal */}
      <Dialog open={showNewExpense} onOpenChange={setShowNewExpense}>
        <DialogContent mobileTask protectDraft className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
            <DialogDescription>Registre uma nova conta a pagar.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Descricao</Label>
              <Input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Descricao da despesa" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <div className="flex gap-2">
                <Select value={expCategory} onValueChange={setExpCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {can("categories.create") && (
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => setShowNewCategory(true)}>
                    <Plus className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Valor Total (R$)</Label>
                <Input type="number" value={expValue} onChange={e => setExpValue(e.target.value)} placeholder="0,00" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Primeiro Vencimento</Label>
                <Input type="date" value={expDueDate} onChange={e => setExpDueDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Número de Parcelas</Label>
                <Input
                  type="number"
                  min="1"
                  value={expInstallments}
                  onChange={e => setExpInstallments(e.target.value)}
                  placeholder="1"
                />
                {Number(expInstallments) > 1 && expValue && (
                  <p className="text-xs text-muted-foreground">
                    {Number(expInstallments)}x de {formatCurrency(Number(expValue) / Number(expInstallments))}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Intervalo (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  value={expInstallmentInterval}
                  onChange={e => setExpInstallmentInterval(e.target.value)}
                  placeholder="30"
                  disabled={Number(expInstallments) <= 1}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewExpense(false)}>Cancelar</Button>
            {expenseError && <p role="alert" className="text-destructive">{expenseError}</p>}
            <Button disabled={savingExpense || !expDesc || !expCategory || !expValue || !expDueDate} onClick={handleCreateExpense}>{savingExpense ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New category modal */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-2">
            <Label>Nome da Categoria</Label>
            <Input value={newCategoryLabel} onChange={e => setNewCategoryLabel(e.target.value)} placeholder="Ex: Alimentacao" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCategory(false)}>Cancelar</Button>
            <Button disabled={!newCategoryLabel} onClick={handleAddCategory}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund modal */}
      <PaymentDialog key={payingExpense?.id ?? "empty"} mixedEnabled={getDataConfig().adapter==="database"} maximum={payingExpense ? payingExpense.value-(payingExpense.paidValue??0) : undefined} open={!!payingExpense} onClose={() => setPayingExpense(null)} title={`Pagar despesa — ${payingExpense?.description || ""} · R$ ${(payingExpense?.value ?? 0).toFixed(2)}`} onConfirm={async (paymentMethod, accountId,value,payments) => {
        if (!payingExpense) return
        await runOperation("pay-expense", { expenseId: payingExpense.expenseId, recordVersion: payingExpense.recordVersion, installmentId: payingExpense.installmentId, paymentMethod, accountId,value,payments })
      }} />
      <Dialog open={!!refundModal} onOpenChange={v => { if (!v) setRefundModal(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Estornar Transacao</DialogTitle>
            <DialogDescription>
              Transacao: {refundModal?.id} - {refundModal?.description} ({formatCurrency(refundModal?.value || 0)})
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2">
              <Lock className="size-4 text-warning-foreground" />
              <span className="text-sm text-warning-foreground">Acao restrita ao Supervisor</span>
            </div>
{getDataConfig().adapter === "demo-localStorage" && (            <div className="flex flex-col gap-1.5">
              <Label>Senha do Supervisor</Label>
              <Input type="password" value={supervisorPass} onChange={e => { setSupervisorPass(e.target.value); setRefundError("") }} placeholder="Digite a senha" />
              {refundError && <p className="text-xs text-destructive">{refundError}</p>}
            </div>)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundModal(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={getDataConfig().adapter === "demo-localStorage" && !supervisorPass} onClick={handleRefund}>Confirmar Estorno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount modal */}
      <Dialog open={showDiscountModal} onOpenChange={setShowDiscountModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aplicar Desconto</DialogTitle>
            <DialogDescription>Selecione a reserva. Teto do operador: {discountCeiling}%.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <Label>Reserva</Label>
            <select className="rounded-md border bg-background p-2" value={discountReservationId} onChange={e => { setDiscountReservationId(e.target.value); setDiscountUnlocked(false) }}>
              <option value="">Selecione uma reserva</option>
              {reservations.filter(r => r.status === "confirmada" || r.status === "checkin").map(r => <option key={r.id} value={r.id}>{r.guestName} — Quarto {r.roomNumber} — {formatCurrency(r.totalValue)}</option>)}
            </select>
            {discountError && <p role="alert" className="text-sm text-destructive">{discountError}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Tipo</Label>
                <Select value={discountType} onValueChange={v => setDiscountType(v as "percent" | "fixed")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Valor</Label>
                <Input
                  type="number" value={discountValue}
                  onChange={e => { setDiscountValue(e.target.value); setDiscountUnlocked(false); setDiscountUnlockPass("") }}
                  placeholder={discountType === "percent" ? "0%" : "R$ 0,00"}
                />
              </div>
            </div>
            {discountNeedsSupervisor && !discountUnlocked && (
              <div className="flex flex-col gap-2 rounded-lg bg-warning/10 p-3">
                <div className="flex items-center gap-2">
                  <Lock className="size-4 text-warning-foreground" />
                  <span className="text-sm text-warning-foreground">Desconto acima do teto. Necessaria senha de liberacao.</span>
                </div>
                <div className="flex gap-2">
                  <Input type="password" value={discountUnlockPass} onChange={e => setDiscountUnlockPass(e.target.value)} placeholder="Senha do supervisor" />
                  <Button size="sm" onClick={async () => { if (await validateSupervisorPasswordAsync(discountUnlockPass)) setDiscountUnlocked(true) }}>Liberar</Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscountModal(false)}>Cancelar</Button>
            <Button disabled={!discountReservationId || !discountValue || (discountNeedsSupervisor && !discountUnlocked)} onClick={handleDiscountCheck}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({
  label, value, icon, variant,
}: {
  label: string; value: number; icon: React.ReactNode
  variant: "success" | "destructive" | "warning" | "primary"
}) {
  const styles = {
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
    primary: "bg-primary/10 text-primary",
  }
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 ${styles[variant]}`}>
      {icon}
      <div className="flex flex-col">
        <span className="text-xs font-medium opacity-70">{label}</span>
        <span className="text-lg font-bold tabular-nums">{formatCurrency(value)}</span>
      </div>
    </div>
  )
}

function TxDetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground">{value}</span>
      </div>
    </div>
  )
}
