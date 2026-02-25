"use client"

import { useState } from "react"
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Plus, Undo2, Lock,
} from "lucide-react"
import type { Transaction } from "@/lib/store"

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDateBR(iso: string) {
  const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00")
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

function daysUntilDue(iso: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(iso + "T12:00:00"); d.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function FinancialTab() {
  const {
    expenses, transactions, categories, cashCloses,
    discountCeiling, addExpense, addTransaction,
    addAuditEntry, addCategory, addCashClose, setDiscountCeiling,
  } = useApp()
  const { isSupervisor, username } = useAuth()

  // New expense modal
  const [showNewExpense, setShowNewExpense] = useState(false)
  const [expDesc, setExpDesc] = useState("")
  const [expCategory, setExpCategory] = useState("")
  const [expValue, setExpValue] = useState("")
  const [expDueDate, setExpDueDate] = useState("")
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

  // Cash close
  const [showCashClose, setShowCashClose] = useState(false)
  const [cashPhysical, setCashPhysical] = useState("")
  const [cashConfirmed, setCashConfirmed] = useState(false)

  const totalReceitas = transactions.filter(t => t.type === "receita").reduce((a, t) => a + t.value, 0)
  const totalDespesas = transactions.filter(t => t.type === "despesa").reduce((a, t) => a + t.value, 0)
  const totalEstornos = transactions.filter(t => t.type === "estorno").reduce((a, t) => a + Math.abs(t.value), 0)
  const netResult = totalReceitas - totalDespesas - totalEstornos
  const unpaidExpenses = expenses.filter(e => !e.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  // Expected cash value (sum of today's transactions)
  const todayISO = new Date().toISOString().split("T")[0]
  const expectedCash = transactions
    .filter(t => t.date === todayISO)
    .reduce((a, t) => a + (t.type === "receita" ? t.value : -t.value), 0)

  function handleCreateExpense() {
    if (!expDesc || !expCategory || !expValue || !expDueDate) return
    const e = {
      id: `E${String(expenses.length + 1).padStart(3, "0")}`,
      description: expDesc,
      category: expCategory,
      value: Number(expValue),
      dueDate: expDueDate,
      paid: false,
    }
    addExpense(e)
    addTransaction({
      id: `T${String(transactions.length + 1).padStart(3, "0")}`,
      date: expDueDate,
      description: expDesc,
      value: Number(expValue),
      type: "despesa",
    })
    setExpDesc(""); setExpCategory(""); setExpValue(""); setExpDueDate("")
    setShowNewExpense(false)
  }

  function handleRefund() {
    if (!refundModal) return
    if (supervisorPass !== "admin") {
      setRefundError("Senha de supervisor incorreta")
      return
    }
    addTransaction({
      id: `T${String(transactions.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString().split("T")[0],
      description: `Estorno: ${refundModal.description}`,
      value: -refundModal.value,
      type: "estorno",
      refId: refundModal.id,
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

  function handleDiscountCheck() {
    const pct = discountType === "percent" ? Number(discountValue) : 0
    if (pct > discountCeiling && discountUnlockPass !== "admin") {
      return
    }
    addAuditEntry({
      user: username || "sistema",
      action: `Desconto aplicado (${discountValue}${discountType === "percent" ? "%" : " R$"})`,
      reference: "Fechamento de reserva",
    })
    setShowDiscountModal(false)
    setDiscountValue("")
    setDiscountUnlockPass("")
    setDiscountUnlocked(false)
  }

  function handleCashConfirm() {
    const physical = Number(cashPhysical)
    const divergence = physical - Math.abs(expectedCash)
    const close = {
      id: `CC${String(cashCloses.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString(),
      operator: username || "operador",
      physicalValue: physical,
      expectedValue: Math.abs(expectedCash),
      divergence,
    }
    addCashClose(close)
    addAuditEntry({
      user: username || "sistema",
      action: `Diferenca de caixa: ${formatCurrency(divergence)}`,
      reference: `Fechamento Turno #${cashCloses.length + 1}`,
    })
    setCashConfirmed(true)
  }

  const discountNeedsSupervisor =
    discountType === "percent" && Number(discountValue) > discountCeiling

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h2 className="text-lg font-semibold text-foreground">Financeiro</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Receitas" value={totalReceitas} icon={<TrendingUp className="size-4" />} variant="success" />
        <SummaryCard label="Despesas" value={totalDespesas} icon={<TrendingDown className="size-4" />} variant="destructive" />
        <SummaryCard label="Estornos" value={totalEstornos} icon={<Undo2 className="size-4" />} variant="warning" />
        {isSupervisor && (
          <SummaryCard label="Liquido" value={netResult} icon={<DollarSign className="size-4" />} variant="primary" />
        )}
      </div>

      <Tabs defaultValue="vencimentos">
        <TabsList>
          <TabsTrigger value="vencimentos">Vencimentos</TabsTrigger>
          <TabsTrigger value="transacoes">Transacoes</TabsTrigger>
          <TabsTrigger value="fechar-turno">Fechar Turno</TabsTrigger>
        </TabsList>

        {/* Upcoming payments */}
        <TabsContent value="vencimentos">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">Proximos Vencimentos</h3>
              <Button size="sm" className="gap-1.5" onClick={() => setShowNewExpense(true)}>
                <Plus className="size-4" /> Nova Despesa
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidExpenses.map((e) => {
                      const days = daysUntilDue(e.dueDate)
                      const isUrgent = days <= 3 && days >= 0
                      const isOverdue = days < 0
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.description}</TableCell>
                          <TableCell className="text-xs">{e.category}</TableCell>
                          <TableCell className="tabular-nums text-xs">{formatCurrency(e.value)}</TableCell>
                          <TableCell className="text-xs">{formatDateBR(e.dueDate)}</TableCell>
                          <TableCell>
                            {isOverdue ? (
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
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Transactions */}
        <TabsContent value="transacoes">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">Historico de Transacoes</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowDiscountModal(true)}>
                  Aplicar Desconto
                </Button>
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Tipo</TableHead>
                      {isSupervisor && <TableHead className="text-right">Acoes</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.id}</TableCell>
                        <TableCell className="text-xs">{formatDateBR(t.date)}</TableCell>
                        <TableCell className="font-medium text-sm">{t.description}</TableCell>
                        <TableCell className={`tabular-nums text-xs font-semibold ${
                          t.type === "receita" ? "text-success" : t.type === "estorno" ? "text-warning-foreground" : "text-destructive"
                        }`}>
                          {t.type === "receita" ? "+" : "-"}{formatCurrency(Math.abs(t.value))}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border-transparent ${
                            t.type === "receita" ? "bg-success/15 text-success" :
                            t.type === "estorno" ? "bg-warning/15 text-warning-foreground" :
                            "bg-destructive/15 text-destructive"
                          }`}>
                            {t.type === "receita" ? "Receita" : t.type === "estorno" ? "Estorno" : "Despesa"}
                          </Badge>
                        </TableCell>
                        {isSupervisor && (
                          <TableCell className="text-right">
                            {t.type === "receita" && (
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
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cash close */}
        <TabsContent value="fechar-turno">
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground">Fechar Turno (Caixa Cego)</h3>
            <Card>
              <CardContent className="py-6">
                {!showCashClose ? (
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Ao fechar o turno, informe o valor fisico em caixa. O sistema nao mostra o valor esperado antes da confirmacao.
                    </p>
                    <Button onClick={() => { setShowCashClose(true); setCashConfirmed(false); setCashPhysical("") }}>
                      Iniciar Fechamento
                    </Button>
                  </div>
                ) : !cashConfirmed ? (
                  <div className="flex flex-col gap-4 max-w-sm mx-auto">
                    <div className="flex flex-col gap-1.5">
                      <Label>Valor Fisico em Caixa (R$)</Label>
                      <Input
                        type="number"
                        placeholder="0,00"
                        value={cashPhysical}
                        onChange={e => setCashPhysical(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowCashClose(false)}>Cancelar</Button>
                      <Button disabled={!cashPhysical} onClick={handleCashConfirm}>Confirmar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 max-w-sm mx-auto animate-fade-in">
                    <div className="rounded-lg bg-secondary/60 p-4 flex flex-col gap-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor informado:</span>
                        <span className="font-semibold">{formatCurrency(Number(cashPhysical))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor esperado:</span>
                        <span className="font-semibold">{formatCurrency(Math.abs(expectedCash))}</span>
                      </div>
                      <div className="border-t border-border mt-1 pt-2 flex justify-between text-sm">
                        <span className="text-muted-foreground">Divergencia:</span>
                        <span className={`font-bold ${
                          Number(cashPhysical) - Math.abs(expectedCash) >= 0 ? "text-success" : "text-destructive"
                        }`}>
                          {formatCurrency(Number(cashPhysical) - Math.abs(expectedCash))}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setShowCashClose(false)}>Fechar</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Previous cash closes */}
            {cashCloses.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <h4 className="text-sm font-semibold text-foreground">Historico de Fechamentos</h4>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Operador</TableHead>
                        <TableHead>Fisico</TableHead>
                        <TableHead>Esperado</TableHead>
                        <TableHead>Divergencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashCloses.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs">{formatDateBR(c.date)}</TableCell>
                          <TableCell className="capitalize text-xs">{c.operator}</TableCell>
                          <TableCell className="tabular-nums text-xs">{formatCurrency(c.physicalValue)}</TableCell>
                          <TableCell className="tabular-nums text-xs">{formatCurrency(c.expectedValue)}</TableCell>
                          <TableCell className={`tabular-nums text-xs font-semibold ${c.divergence >= 0 ? "text-success" : "text-destructive"}`}>
                            {formatCurrency(c.divergence)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* New expense modal */}
      <Dialog open={showNewExpense} onOpenChange={setShowNewExpense}>
        <DialogContent className="sm:max-w-md">
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
                {isSupervisor && (
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => setShowNewCategory(true)}>
                    <Plus className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Valor (R$)</Label>
                <Input type="number" value={expValue} onChange={e => setExpValue(e.target.value)} placeholder="0,00" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Vencimento</Label>
                <Input type="date" value={expDueDate} onChange={e => setExpDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewExpense(false)}>Cancelar</Button>
            <Button disabled={!expDesc || !expCategory || !expValue || !expDueDate} onClick={handleCreateExpense}>Salvar</Button>
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

      {/* Refund modal (supervisor only) */}
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
            <div className="flex flex-col gap-1.5">
              <Label>Senha do Supervisor</Label>
              <Input type="password" value={supervisorPass} onChange={e => { setSupervisorPass(e.target.value); setRefundError("") }} placeholder="Digite a senha" />
              {refundError && <p className="text-xs text-destructive">{refundError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundModal(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={!supervisorPass} onClick={handleRefund}>Confirmar Estorno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount modal */}
      <Dialog open={showDiscountModal} onOpenChange={setShowDiscountModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aplicar Desconto</DialogTitle>
            <DialogDescription>Teto do operador: {discountCeiling}%</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Tipo</Label>
                <Select value={discountType} onValueChange={v => setDiscountType(v as "percent" | "fixed")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Valor</Label>
                <Input
                  type="number"
                  value={discountValue}
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
                  <Input
                    type="password"
                    value={discountUnlockPass}
                    onChange={e => setDiscountUnlockPass(e.target.value)}
                    placeholder="Senha do supervisor"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (discountUnlockPass === "admin") setDiscountUnlocked(true)
                    }}
                  >
                    Liberar
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscountModal(false)}>Cancelar</Button>
            <Button
              disabled={!discountValue || (discountNeedsSupervisor && !discountUnlocked)}
              onClick={handleDiscountCheck}
            >
              Aplicar
            </Button>
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
