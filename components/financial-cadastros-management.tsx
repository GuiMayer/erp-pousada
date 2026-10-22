"use client"

import { useState, type ReactNode } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2 } from "lucide-react"
import type { BankAccount, BankTransfer, Budget, BudgetCategory, CostCenter, RecurringTransaction } from "@/lib/store"
import { formatCurrency } from "@/lib/utils/formatters"

export type FinancialResource = "bankAccount" | "bankTransfer" | "costCenter" | "budget" | "recurringTransaction"

const emptyBankAccount: Omit<BankAccount, "id"> = {
  name: "",
  type: "conta_corrente",
  bank: "",
  agency: "",
  accountNumber: "",
  initialBalance: 0,
  currentBalance: 0,
  active: true,
}

const emptyCostCenter: Omit<CostCenter, "id"> = {
  name: "",
  description: "",
  active: true,
}

const emptyBankTransfer: Omit<BankTransfer, "id"> = {
  date: new Date().toISOString().split("T")[0],
  fromAccountId: "",
  toAccountId: "",
  value: 0,
  description: "",
  responsible: "",
}

const emptyBudgetCategory: BudgetCategory = {
  categoryId: "",
  categoryName: "",
  plannedAmount: 0,
  spentAmount: 0,
  variance: 0,
  variancePercent: 0,
}

const emptyBudget: Omit<Budget, "id"> = {
  name: "",
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  categories: [],
  status: "ativo",
}

const emptyRecurringTransaction: Omit<RecurringTransaction, "id"> = {
  description: "",
  value: 0,
  type: "despesa",
  category: "",
  accountId: undefined,
  frequency: "mensal",
  dayOfMonth: 1,
  startDate: new Date().toISOString().split("T")[0],
  active: true,
}

export function FinancialCadastrosManagement({ sections, balancesOnly = false, recurringType }: { sections: FinancialResource[]; balancesOnly?: boolean; recurringType?: RecurringTransaction["type"] }) {
  const {
    bankAccounts, bankTransfers, costCenters, budgets, recurringTransactions,
    addBankAccount, updateBankAccount, removeBankAccount,
    addBankTransfer, updateBankTransfer, removeBankTransfer,
    addCostCenter, updateCostCenter, removeCostCenter,
    addBudget, updateBudget, removeBudget,
    addRecurringTransaction, updateRecurringTransaction, removeRecurringTransaction,
    addAuditEntry,
  } = useApp()
  const { username, can } = useAuth()
  const collections: Record<FinancialResource, string> = { bankAccount: "bankAccounts", bankTransfer: "bankTransfers", costCenter: "costCenters", budget: "budgets", recurringTransaction: "recurringTransactions" }
  const allowed = (type: FinancialResource, action = "read") => type === "bankTransfer" && action === "create" ? can("bankAccounts.transfer") : can(`${collections[type]}.${action}`)
  const visible = (type: FinancialResource) => sections.includes(type) && (allowed(type) || type === "bankTransfer" && allowed(type, "create"))

  const [dialogType, setFinancialResource] = useState<FinancialResource | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bankForm, setBankForm] = useState(emptyBankAccount)
  const [transferForm, setTransferForm] = useState(emptyBankTransfer)
  const [costCenterForm, setCostCenterForm] = useState(emptyCostCenter)
  const [budgetForm, setBudgetForm] = useState(emptyBudget)
  const [budgetCategoryForm, setBudgetCategoryForm] = useState(emptyBudgetCategory)
  const [recurringForm, setRecurringForm] = useState(emptyRecurringTransaction)
  const [error, setError] = useState("")

  const auditUser = username || "sistema"

  function openBankAccount(account?: BankAccount) {
    setFinancialResource("bankAccount")
    setEditingId(account?.id ?? null)
    setBankForm(account ? { ...account } : emptyBankAccount)
    setError("")
  }

  function openCostCenter(costCenter?: CostCenter) {
    setFinancialResource("costCenter")
    setEditingId(costCenter?.id ?? null)
    setCostCenterForm(costCenter ? { ...costCenter } : emptyCostCenter)
    setError("")
  }

  function openBankTransfer(transfer?: BankTransfer) {
    setFinancialResource("bankTransfer")
    setEditingId(transfer?.id ?? null)
    setTransferForm(transfer ? { ...transfer } : { ...emptyBankTransfer, responsible: auditUser })
    setError("")
  }

  function openBudget(budget?: Budget) {
    setFinancialResource("budget")
    setEditingId(budget?.id ?? null)
    setBudgetForm(budget ? { ...budget, categories: budget.categories.map(category => ({ ...category })) } : emptyBudget)
    setBudgetCategoryForm(emptyBudgetCategory)
    setError("")
  }

  function openRecurringTransaction(transaction?: RecurringTransaction) {
    setFinancialResource("recurringTransaction")
    setEditingId(transaction?.id ?? null)
    setRecurringForm(transaction ? { ...transaction } : { ...emptyRecurringTransaction, type: recurringType ?? emptyRecurringTransaction.type })
    setError("")
  }

  function closeDialog() {
    setFinancialResource(null)
    setEditingId(null)
    setError("")
  }

  async function saveBankAccount() {
    if (!allowed("bankAccount", editingId ? "edit" : "create")) return
    try {
    if (!bankForm.name.trim()) {
      setError("Informe o nome da conta.")
      return
    }

    if (editingId) {
      await updateBankAccount(editingId, bankForm)
      await addAuditEntry({ entityType: "bankAccounts", operation: "update", user: auditUser, action: bankForm.active ? "Conta bancaria editada" : "Conta bancaria desativada", reference: bankForm.name })
    } else {
      await addBankAccount({ id: `BA${Date.now()}`, ...bankForm })
      await addAuditEntry({ entityType: "bankAccounts", operation: "create", user: auditUser, action: "Conta bancaria criada", reference: bankForm.name })
    }
    closeDialog()

    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar") }
  }

  async function saveCostCenter() {
    if (!allowed("costCenter", editingId ? "edit" : "create")) return
    try {
    if (!costCenterForm.name.trim()) {
      setError("Informe o nome do centro de custo.")
      return
    }

    if (editingId) {
      await updateCostCenter(editingId, costCenterForm)
      await addAuditEntry({ entityType: "costCenters", operation: "update", user: auditUser, action: costCenterForm.active ? "Centro de custo editado" : "Centro de custo desativado", reference: costCenterForm.name })
    } else {
      await addCostCenter({ id: `CC${Date.now()}`, ...costCenterForm })
      await addAuditEntry({ entityType: "costCenters", operation: "create", user: auditUser, action: "Centro de custo criado", reference: costCenterForm.name })
    }
    closeDialog()

    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar") }
  }

  async function saveBankTransfer() {
    if (!allowed("bankTransfer", editingId ? "edit" : "create")) return
    try {
    if (!transferForm.fromAccountId || !transferForm.toAccountId || transferForm.fromAccountId === transferForm.toAccountId || transferForm.value <= 0) {
      setError("Informe contas diferentes e valor maior que zero.")
      return
    }

    try {
      if (editingId) { setError("Transferências registradas são imutáveis"); return }
      await addBankTransfer({ id: crypto.randomUUID(), ...transferForm, description: transferForm.description || "Transferência entre contas", responsible: transferForm.responsible || auditUser })
      closeDialog()
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Transferência não concluída") }

    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar") }
  }

  async function saveBudget() {
    if (!allowed("budget", editingId ? "edit" : "create")) return
    try {
    if (!budgetForm.name.trim() || budgetForm.year < 2000) {
      setError("Informe nome e ano validos para o orcamento.")
      return
    }

    if (editingId) {
      await updateBudget(editingId, budgetForm)
      await addAuditEntry({ entityType: "budgets", operation: "update", user: auditUser, action: budgetForm.status === "ativo" ? "Orcamento editado" : "Orcamento arquivado", reference: budgetForm.name })
    } else {
      await addBudget({ id: `BUD${Date.now()}`, ...budgetForm })
      await addAuditEntry({ entityType: "budgets", operation: "create", user: auditUser, action: "Orcamento criado", reference: budgetForm.name })
    }
    closeDialog()

    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar") }
  }

  function addBudgetCategory() {
    if (!budgetCategoryForm.categoryName.trim() || budgetCategoryForm.plannedAmount < 0) {
      setError("Informe categoria e valor planejado valido.")
      return
    }

    const category: BudgetCategory = {
      ...budgetCategoryForm,
      categoryId: budgetCategoryForm.categoryId || `cat-${Date.now()}`,
      variance: budgetCategoryForm.plannedAmount - budgetCategoryForm.spentAmount,
      variancePercent: budgetCategoryForm.plannedAmount > 0
        ? ((budgetCategoryForm.plannedAmount - budgetCategoryForm.spentAmount) / budgetCategoryForm.plannedAmount) * 100
        : 0,
    }

    setBudgetForm(prev => ({ ...prev, categories: [...prev.categories, category] }))
    setBudgetCategoryForm(emptyBudgetCategory)
    setError("")
  }

  function removeBudgetCategory(categoryId: string) {
    setBudgetForm(prev => ({ ...prev, categories: prev.categories.filter(category => category.categoryId !== categoryId) }))
  }

  async function saveRecurringTransaction() {
    if (!allowed("recurringTransaction", editingId ? "edit" : "create")) return
    try {
    if (!recurringForm.description.trim() || !recurringForm.category.trim() || recurringForm.value <= 0) {
      setError("Informe descricao, categoria e valor maior que zero.")
      return
    }

    if (editingId) {
      await updateRecurringTransaction(editingId, recurringForm)
      await addAuditEntry({ entityType: "recurringTransactions", operation: "update", user: auditUser, action: recurringForm.active ? "Recorrencia editada" : "Recorrencia desativada", reference: recurringForm.description })
    } else {
      await addRecurringTransaction({ id: `RT${Date.now()}`, ...recurringForm })
      await addAuditEntry({ entityType: "recurringTransactions", operation: "create", user: auditUser, action: "Recorrencia criada", reference: recurringForm.description })
    }
    closeDialog()

    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar") }
  }

  async function removeCadastro(type: FinancialResource, id: string, reference: string, expectedVersion?: number) {
    if (!allowed(type, "delete") || !confirm(`Excluir "${reference}"?`)) return

    if (type === "bankAccount") {
      await removeBankAccount(id, expectedVersion)
      await addAuditEntry({ entityType: "bankAccounts", operation: "delete", user: auditUser, action: "Conta bancaria removida", reference })
    } else if (type === "bankTransfer") {
      await removeBankTransfer(id)
      await addAuditEntry({ entityType: "bankTransfers", operation: "delete", user: auditUser, action: "Transferencia removida", reference })
    } else if (type === "costCenter") {
      await removeCostCenter(id, expectedVersion)
      await addAuditEntry({ entityType: "costCenters", operation: "delete", user: auditUser, action: "Centro de custo removido", reference })
    } else if (type === "budget") {
      await removeBudget(id, expectedVersion)
      await addAuditEntry({ entityType: "budgets", operation: "delete", user: auditUser, action: "Orcamento removido", reference })
    } else {
      await removeRecurringTransaction(id, expectedVersion)
      await addAuditEntry({ entityType: "recurringTransactions", operation: "delete", user: auditUser, action: "Recorrencia removida", reference })
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {visible("bankAccount") && <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">{balancesOnly ? "Saldos das contas" : "Contas bancárias"}</CardTitle>
          {allowed("bankAccount", "create") && !balancesOnly && <Button aria-label="Nova conta bancária" size="sm" variant="outline" onClick={() => openBankAccount()}><Plus className="size-4" /></Button>}
        </CardHeader>
        <CardContent className="space-y-2">
          {bankAccounts.map(account => (
            <div key={account.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{account.name}</div>
                <div className="text-xs text-muted-foreground">{balancesOnly ? formatCurrency(account.currentBalance) : account.bank || "Conta bancária"}</div>
              </div>
              {!balancesOnly && <RowActions collection="bankAccounts" active={account.active} onEdit={() => openBankAccount(account)} onDelete={() => removeCadastro("bankAccount", account.id, account.name, account.recordVersion)} />}
            </div>
          ))}
          {bankAccounts.length === 0 && <EmptyState label="Nenhuma conta cadastrada." />}
        </CardContent>
      </Card>
      </>}

      {visible("bankTransfer") && <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Transferencias</CardTitle>
          {allowed("bankTransfer", "create") && <Button aria-label="Nova transferência" size="sm" variant="outline" onClick={() => openBankTransfer()}><Plus className="size-4" /></Button>}
        </CardHeader>
        <CardContent className="space-y-2">
          {(allowed("bankTransfer") ? bankTransfers : []).map(transfer => (
            <div key={transfer.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{transfer.description || "Transferencia"}</div>
                <div className="text-xs text-muted-foreground">{transfer.date} - {formatCurrency(transfer.value)}</div>
              </div>
              <span className="text-xs text-muted-foreground">Transferência registrada · histórico preservado</span>
            </div>
          ))}
          {bankTransfers.length === 0 && <EmptyState label="Nenhuma transferencia cadastrada." />}
        </CardContent>
      </Card>
      </>}

      {visible("costCenter") && <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Centros de Custo</CardTitle>
          {allowed("costCenter", "create") && <Button aria-label="Novo centro de custo" size="sm" variant="outline" onClick={() => openCostCenter()}><Plus className="size-4" /></Button>}
        </CardHeader>
        <CardContent className="space-y-2">
          {costCenters.map(costCenter => (
            <div key={costCenter.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{costCenter.name}</div>
                <div className="text-xs text-muted-foreground">{costCenter.description || "Sem descricao"}</div>
              </div>
              <RowActions collection="costCenters" active={costCenter.active} onEdit={() => openCostCenter(costCenter)} onDelete={() => removeCadastro("costCenter", costCenter.id, costCenter.name, costCenter.recordVersion)} />
            </div>
          ))}
          {costCenters.length === 0 && <EmptyState label="Nenhum centro de custo cadastrado." />}
        </CardContent>
      </Card>
      </>}

      {visible("budget") && <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Orcamentos</CardTitle>
          {allowed("budget", "create") && <Button aria-label="Novo orçamento" size="sm" variant="outline" onClick={() => openBudget()}><Plus className="size-4" /></Button>}
        </CardHeader>
        <CardContent className="space-y-2">
          {budgets.map(budget => (
            <div key={budget.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{budget.name}</div>
                <div className="text-xs text-muted-foreground">{budget.month ? `${budget.month}/` : ""}{budget.year} - {budget.categories.length} categoria(s)</div>
              </div>
              <RowActions collection="budgets" active={budget.status === "ativo"} onEdit={() => openBudget(budget)} onDelete={() => removeCadastro("budget", budget.id, budget.name, budget.recordVersion)} />
            </div>
          ))}
          {budgets.length === 0 && <EmptyState label="Nenhum orcamento cadastrado." />}
        </CardContent>
      </Card>
      </>}

      {visible("recurringTransaction") && <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Recorrencias</CardTitle>
          {allowed("recurringTransaction", "create") && <Button aria-label="Nova recorrência" size="sm" variant="outline" onClick={() => openRecurringTransaction()}><Plus className="size-4" /></Button>}
        </CardHeader>
        <CardContent className="space-y-2">
          {recurringTransactions.filter(t => !recurringType || t.type === recurringType).map(transaction => (
            <div key={transaction.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{transaction.description}</div>
                <div className="text-xs text-muted-foreground">{transaction.frequency} - {formatCurrency(transaction.value)}</div>
              </div>
              <RowActions collection="recurringTransactions" active={transaction.active} onEdit={() => openRecurringTransaction(transaction)} onDelete={() => removeCadastro("recurringTransaction", transaction.id, transaction.description, transaction.recordVersion)} />
            </div>
          ))}
          {!recurringTransactions.some(t => !recurringType || t.type === recurringType) && <EmptyState label="Nenhuma recorrencia cadastrada." />}
        </CardContent>
      </Card>
      </>}

      <Dialog open={dialogType === "bankAccount" && visible("bankAccount") && allowed("bankAccount", editingId ? "edit" : "create")} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Conta" : "Nova Conta"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FormError message={error} />
            <Field label="Nome"><Input value={bankForm.name} onChange={e => setBankForm(prev => ({ ...prev, name: e.target.value }))} /></Field>
            <Field label="Tipo">
              <Select value={bankForm.type} onValueChange={value => setBankForm(prev => ({ ...prev, type: value as BankAccount["type"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="caixa">Caixa</SelectItem>
                  <SelectItem value="conta_corrente">Conta Corrente</SelectItem>
                  <SelectItem value="poupanca">Poupanca</SelectItem>
                  <SelectItem value="cartao">Cartao</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Banco"><Input value={bankForm.bank || ""} onChange={e => setBankForm(prev => ({ ...prev, bank: e.target.value }))} /></Field>
            <Field label="Saldo atual"><Input type="number" disabled={!!editingId} value={bankForm.currentBalance} onChange={e => setBankForm(prev => ({ ...prev, currentBalance: Number(e.target.value), initialBalance: editingId ? prev.initialBalance : Number(e.target.value) }))} /></Field>
            <ActiveSwitch checked={bankForm.active} onChange={active => setBankForm(prev => ({ ...prev, active }))} />
          </div>
          <DialogFooter><Button variant="outline" onClick={closeDialog}>Cancelar</Button><Button onClick={saveBankAccount}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "bankTransfer" && visible("bankTransfer") && allowed("bankTransfer", editingId ? "edit" : "create")} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Transferencia" : "Nova Transferencia"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FormError message={error} />
            <Field label="Data"><Input type="date" value={transferForm.date} onChange={e => setTransferForm(prev => ({ ...prev, date: e.target.value }))} /></Field>
            <Field label="Descricao"><Input value={transferForm.description} onChange={e => setTransferForm(prev => ({ ...prev, description: e.target.value }))} /></Field>
            <Field label="Conta de origem">
              <Select value={transferForm.fromAccountId} onValueChange={value => setTransferForm(prev => ({ ...prev, fromAccountId: value }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{bankAccounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Conta de destino">
              <Select value={transferForm.toAccountId} onValueChange={value => setTransferForm(prev => ({ ...prev, toAccountId: value }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{bankAccounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Valor"><Input type="number" value={transferForm.value} onChange={e => setTransferForm(prev => ({ ...prev, value: Number(e.target.value) }))} /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={closeDialog}>Cancelar</Button><Button onClick={saveBankTransfer}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "costCenter" && visible("costCenter") && allowed("costCenter", editingId ? "edit" : "create")} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Centro" : "Novo Centro"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FormError message={error} />
            <Field label="Nome"><Input value={costCenterForm.name} onChange={e => setCostCenterForm(prev => ({ ...prev, name: e.target.value }))} /></Field>
            <Field label="Descricao"><Input value={costCenterForm.description || ""} onChange={e => setCostCenterForm(prev => ({ ...prev, description: e.target.value }))} /></Field>
            <ActiveSwitch checked={costCenterForm.active} onChange={active => setCostCenterForm(prev => ({ ...prev, active }))} />
          </div>
          <DialogFooter><Button variant="outline" onClick={closeDialog}>Cancelar</Button><Button onClick={saveCostCenter}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "budget" && visible("budget") && allowed("budget", editingId ? "edit" : "create")} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? "Editar Orcamento" : "Novo Orcamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FormError message={error} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nome"><Input value={budgetForm.name} onChange={e => setBudgetForm(prev => ({ ...prev, name: e.target.value }))} /></Field>
              <Field label="Ano"><Input type="number" value={budgetForm.year} onChange={e => setBudgetForm(prev => ({ ...prev, year: Number(e.target.value) }))} /></Field>
              <Field label="Mes"><Input type="number" min={1} max={12} value={budgetForm.month || ""} onChange={e => setBudgetForm(prev => ({ ...prev, month: e.target.value ? Number(e.target.value) : undefined }))} /></Field>
            </div>
            <Field label="Status">
              <Select value={budgetForm.status} onValueChange={value => setBudgetForm(prev => ({ ...prev, status: value as Budget["status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="arquivado">Arquivado</SelectItem></SelectContent>
              </Select>
            </Field>
            <div className="rounded-md border p-3">
              <div className="mb-3 text-sm font-medium">Categorias do orcamento</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_120px_120px_auto]">
                <Input placeholder="Categoria" value={budgetCategoryForm.categoryName} onChange={e => setBudgetCategoryForm(prev => ({ ...prev, categoryName: e.target.value }))} />
                <Input type="number" placeholder="Planejado" value={budgetCategoryForm.plannedAmount} onChange={e => setBudgetCategoryForm(prev => ({ ...prev, plannedAmount: Number(e.target.value) }))} />
                <Input type="number" placeholder="Realizado" value={budgetCategoryForm.spentAmount} onChange={e => setBudgetCategoryForm(prev => ({ ...prev, spentAmount: Number(e.target.value) }))} />
                <Button type="button" variant="outline" onClick={addBudgetCategory}>Adicionar</Button>
              </div>
              <div className="mt-3 space-y-2">
                {budgetForm.categories.map(category => (
                  <div key={category.categoryId} className="flex items-center justify-between rounded-md bg-muted/40 p-2 text-sm">
                    <span>{category.categoryName} - {formatCurrency(category.plannedAmount)}</span>
                    <Button size="sm" variant="ghost" onClick={() => removeBudgetCategory(category.categoryId)}><Trash2 className="size-4" /></Button>
                  </div>
                ))}
                {budgetForm.categories.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma categoria adicionada.</div>}
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={closeDialog}>Cancelar</Button><Button onClick={saveBudget}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "recurringTransaction" && visible("recurringTransaction") && allowed("recurringTransaction", editingId ? "edit" : "create")} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Recorrencia" : "Nova Recorrencia"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FormError message={error} />
            <Field label="Descricao"><Input value={recurringForm.description} onChange={e => setRecurringForm(prev => ({ ...prev, description: e.target.value }))} /></Field>
            <Field label="Categoria"><Input value={recurringForm.category} onChange={e => setRecurringForm(prev => ({ ...prev, category: e.target.value }))} /></Field>
            <Field label="Valor"><Input type="number" value={recurringForm.value} onChange={e => setRecurringForm(prev => ({ ...prev, value: Number(e.target.value) }))} /></Field>
            <Field label="Tipo">
              <Select value={recurringForm.type} onValueChange={value => setRecurringForm(prev => ({ ...prev, type: value as RecurringTransaction["type"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Frequencia">
              <Select value={recurringForm.frequency} onValueChange={value => setRecurringForm(prev => ({ ...prev, frequency: value as RecurringTransaction["frequency"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="diaria">Diaria</SelectItem><SelectItem value="semanal">Semanal</SelectItem><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="anual">Anual</SelectItem></SelectContent>
              </Select>
            </Field>
            <ActiveSwitch checked={recurringForm.active} onChange={active => setRecurringForm(prev => ({ ...prev, active }))} />
          </div>
          <DialogFooter><Button variant="outline" onClick={closeDialog}>Cancelar</Button><Button onClick={saveRecurringTransaction}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{label}</div>
}

function RowActions({ collection, active, onEdit, onDelete }: { collection: string; active: boolean; onEdit: () => void; onDelete: () => void }) {
  const { can } = useAuth()
  return (
    <div className="flex items-center gap-1">
      <Badge variant={active ? "default" : "secondary"}>{active ? "Ativo" : "Inativo"}</Badge>
      <Button aria-label="Editar cadastro" disabled={!can(`${collection}.edit`)} size="sm" variant="ghost" onClick={onEdit}><Pencil className="size-4" /></Button>
      <Button aria-label="Excluir cadastro" disabled={!can(`${collection}.delete`)} size="sm" variant="ghost" onClick={onDelete}><Trash2 className="size-4" /></Button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function ActiveSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-md border p-3"><Label>Ativo</Label><Switch checked={checked} onCheckedChange={onChange} /></div>
}

function FormError({ message }: { message: string }) {
  if (!message) return null
  return <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</div>
}
