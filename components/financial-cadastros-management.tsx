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
import type { BankAccount, CostCenter, RecurringTransaction } from "@/lib/store"
import { formatCurrency } from "@/lib/utils/formatters"

type DialogType = "bankAccount" | "costCenter" | "recurringTransaction"

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

export function FinancialCadastrosManagement() {
  const {
    bankAccounts, costCenters, recurringTransactions,
    addBankAccount, updateBankAccount, removeBankAccount,
    addCostCenter, updateCostCenter, removeCostCenter,
    addRecurringTransaction, updateRecurringTransaction, removeRecurringTransaction,
    addAuditEntry,
  } = useApp()
  const { username } = useAuth()

  const [dialogType, setDialogType] = useState<DialogType | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bankForm, setBankForm] = useState(emptyBankAccount)
  const [costCenterForm, setCostCenterForm] = useState(emptyCostCenter)
  const [recurringForm, setRecurringForm] = useState(emptyRecurringTransaction)
  const [error, setError] = useState("")

  const auditUser = username || "sistema"

  function openBankAccount(account?: BankAccount) {
    setDialogType("bankAccount")
    setEditingId(account?.id ?? null)
    setBankForm(account ? { ...account } : emptyBankAccount)
    setError("")
  }

  function openCostCenter(costCenter?: CostCenter) {
    setDialogType("costCenter")
    setEditingId(costCenter?.id ?? null)
    setCostCenterForm(costCenter ? { ...costCenter } : emptyCostCenter)
    setError("")
  }

  function openRecurringTransaction(transaction?: RecurringTransaction) {
    setDialogType("recurringTransaction")
    setEditingId(transaction?.id ?? null)
    setRecurringForm(transaction ? { ...transaction } : emptyRecurringTransaction)
    setError("")
  }

  function closeDialog() {
    setDialogType(null)
    setEditingId(null)
    setError("")
  }

  async function saveBankAccount() {
    if (!bankForm.name.trim()) {
      setError("Informe o nome da conta.")
      return
    }

    if (editingId) {
      await updateBankAccount(editingId, bankForm)
      await addAuditEntry({ user: auditUser, action: bankForm.active ? "Conta bancaria editada" : "Conta bancaria desativada", reference: bankForm.name })
    } else {
      await addBankAccount({ id: `BA${Date.now()}`, ...bankForm })
      await addAuditEntry({ user: auditUser, action: "Conta bancaria criada", reference: bankForm.name })
    }
    closeDialog()
  }

  async function saveCostCenter() {
    if (!costCenterForm.name.trim()) {
      setError("Informe o nome do centro de custo.")
      return
    }

    if (editingId) {
      await updateCostCenter(editingId, costCenterForm)
      await addAuditEntry({ user: auditUser, action: costCenterForm.active ? "Centro de custo editado" : "Centro de custo desativado", reference: costCenterForm.name })
    } else {
      await addCostCenter({ id: `CC${Date.now()}`, ...costCenterForm })
      await addAuditEntry({ user: auditUser, action: "Centro de custo criado", reference: costCenterForm.name })
    }
    closeDialog()
  }

  async function saveRecurringTransaction() {
    if (!recurringForm.description.trim() || !recurringForm.category.trim() || recurringForm.value <= 0) {
      setError("Informe descricao, categoria e valor maior que zero.")
      return
    }

    if (editingId) {
      await updateRecurringTransaction(editingId, recurringForm)
      await addAuditEntry({ user: auditUser, action: recurringForm.active ? "Recorrencia editada" : "Recorrencia desativada", reference: recurringForm.description })
    } else {
      await addRecurringTransaction({ id: `RT${Date.now()}`, ...recurringForm })
      await addAuditEntry({ user: auditUser, action: "Recorrencia criada", reference: recurringForm.description })
    }
    closeDialog()
  }

  async function removeCadastro(type: DialogType, id: string, reference: string) {
    if (!confirm(`Excluir "${reference}"?`)) return

    if (type === "bankAccount") {
      await removeBankAccount(id)
      await addAuditEntry({ user: auditUser, action: "Conta bancaria removida", reference })
    } else if (type === "costCenter") {
      await removeCostCenter(id)
      await addAuditEntry({ user: auditUser, action: "Centro de custo removido", reference })
    } else {
      await removeRecurringTransaction(id)
      await addAuditEntry({ user: auditUser, action: "Recorrencia removida", reference })
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Contas Bancarias</CardTitle>
          <Button size="sm" variant="outline" onClick={() => openBankAccount()}><Plus className="size-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {bankAccounts.map(account => (
            <div key={account.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{account.name}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(account.currentBalance)}</div>
              </div>
              <RowActions active={account.active} onEdit={() => openBankAccount(account)} onDelete={() => removeCadastro("bankAccount", account.id, account.name)} />
            </div>
          ))}
          {bankAccounts.length === 0 && <EmptyState label="Nenhuma conta cadastrada." />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Centros de Custo</CardTitle>
          <Button size="sm" variant="outline" onClick={() => openCostCenter()}><Plus className="size-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {costCenters.map(costCenter => (
            <div key={costCenter.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{costCenter.name}</div>
                <div className="text-xs text-muted-foreground">{costCenter.description || "Sem descricao"}</div>
              </div>
              <RowActions active={costCenter.active} onEdit={() => openCostCenter(costCenter)} onDelete={() => removeCadastro("costCenter", costCenter.id, costCenter.name)} />
            </div>
          ))}
          {costCenters.length === 0 && <EmptyState label="Nenhum centro de custo cadastrado." />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Recorrencias</CardTitle>
          <Button size="sm" variant="outline" onClick={() => openRecurringTransaction()}><Plus className="size-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {recurringTransactions.map(transaction => (
            <div key={transaction.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{transaction.description}</div>
                <div className="text-xs text-muted-foreground">{transaction.frequency} - {formatCurrency(transaction.value)}</div>
              </div>
              <RowActions active={transaction.active} onEdit={() => openRecurringTransaction(transaction)} onDelete={() => removeCadastro("recurringTransaction", transaction.id, transaction.description)} />
            </div>
          ))}
          {recurringTransactions.length === 0 && <EmptyState label="Nenhuma recorrencia cadastrada." />}
        </CardContent>
      </Card>

      <Dialog open={dialogType === "bankAccount"} onOpenChange={(open) => { if (!open) closeDialog() }}>
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
            <Field label="Saldo atual"><Input type="number" value={bankForm.currentBalance} onChange={e => setBankForm(prev => ({ ...prev, currentBalance: Number(e.target.value), initialBalance: editingId ? prev.initialBalance : Number(e.target.value) }))} /></Field>
            <ActiveSwitch checked={bankForm.active} onChange={active => setBankForm(prev => ({ ...prev, active }))} />
          </div>
          <DialogFooter><Button variant="outline" onClick={closeDialog}>Cancelar</Button><Button onClick={saveBankAccount}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "costCenter"} onOpenChange={(open) => { if (!open) closeDialog() }}>
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

      <Dialog open={dialogType === "recurringTransaction"} onOpenChange={(open) => { if (!open) closeDialog() }}>
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

function RowActions({ active, onEdit, onDelete }: { active: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <Badge variant={active ? "default" : "secondary"}>{active ? "Ativo" : "Inativo"}</Badge>
      <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="size-4" /></Button>
      <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="size-4" /></Button>
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
