"use client"

import { useState, useMemo } from "react"
import { validateCPF } from "@/lib/utils/validators"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Users, Plus, Pencil, Trash2, UserCheck, UserX } from "lucide-react"
import type { Employee, EmployeeRole } from "@/lib/store"

const EMPLOYEE_ROLES: { value: EmployeeRole; label: string }[] = [
  { value: "caixa", label: "Caixa" },
  { value: "cozinha", label: "Cozinha" },
  { value: "atendimento", label: "Garçom" },
  { value: "gerente", label: "Gerente" },
]

type Mode = "list" | "add" | "edit"

interface Props {
  open: boolean
  onClose: () => void
}

export function ManageEmployeesModal({ open, onClose }: Props) {
  const { employees, addEmployee, updateEmployee, addAuditEntry, employeeConsumptions } = useApp()
  const { username } = useAuth()

  const [mode, setMode] = useState<Mode>("list")
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null)
  const [hardDelete, setHardDelete] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [cpfValue, setCpfValue] = useState("")
  const [role, setRole] = useState<EmployeeRole>("atendimento")
  const [consumptionLimit, setConsumptionLimit] = useState("50")
  const [lunchIncluded, setLunchIncluded] = useState(true)
  const [dinnerIncluded, setDinnerIncluded] = useState(true)
  const [snackIncluded, setSnackIncluded] = useState(false)
  const [formError, setFormError] = useState("")

  // Filter
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all")

  const filteredEmployees = useMemo(() => {
    let result = employees
    if (filter === "active") result = result.filter(e => e.active)
    if (filter === "inactive") result = result.filter(e => !e.active)
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }, [employees, filter])

  function resetForm() {
    setName("")
    setCpfValue("")
    setRole("atendimento")
    setConsumptionLimit("50")
    setLunchIncluded(true)
    setDinnerIncluded(true)
    setSnackIncluded(false)
    setFormError("")
    setEditingEmployee(null)
  }

  function formatCPF(value: string): string {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
    if (numbers.length <= 9)
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
  }

  function handleCPFChange(value: string) {
    const formatted = formatCPF(value)
    setCpfValue(formatted)
    setFormError("")
  }

  function validateForm(): boolean {
    if (!name.trim()) {
      setFormError("Nome é obrigatório")
      return false
    }

    const cleanCPF = cpfValue.replace(/\D/g, "")
    const cpfValidation = validateCPF(cleanCPF)
    if (!cpfValidation.valid) {
      setFormError(cpfValidation.error || "CPF inválido")
      return false
    }

    // Check duplicate CPF
    const duplicate = employees.find(
      e => e.cpf === cleanCPF && (!editingEmployee || e.id !== editingEmployee.id)
    )
    if (duplicate) {
      setFormError("CPF já cadastrado")
      return false
    }

    const limit = parseFloat(consumptionLimit)
    if (isNaN(limit) || limit < 0) {
      setFormError("Limite de consumo inválido")
      return false
    }

    return true
  }

  async function handleAdd() {
    try {
    if (!validateForm()) return

    const newId = crypto.randomUUID()
    const cleanCPF = cpfValue.replace(/\D/g, "")

    await addEmployee({
      id: newId,
      name: name.trim(),
      cpf: cleanCPF,
      role,
      active: true,
      consumptionLimit: parseFloat(consumptionLimit),
      mealBenefit: {
        lunchIncluded,
        dinnerIncluded,
        snackIncluded,
      },
    })

    addAuditEntry({
      user: username || "sistema",
      action: "Funcionário adicionado",
      reference: `${name} - ${role}`,
    })

    resetForm()
    setMode("list")

    } catch (failure) { setFormError(failure instanceof Error ? failure.message : "Não foi possível salvar") }
  }

  async function handleEdit() {
    try {
    if (!editingEmployee || !validateForm()) return

    const cleanCPF = cpfValue.replace(/\D/g, "")

    await updateEmployee(editingEmployee.id, {
      recordVersion: editingEmployee.recordVersion,
      name: name.trim(),
      cpf: cleanCPF,
      role,
      consumptionLimit: parseFloat(consumptionLimit),
      mealBenefit: {
        lunchIncluded,
        dinnerIncluded,
        snackIncluded,
      },
    })

    addAuditEntry({
      user: username || "sistema",
      action: "Funcionário editado",
      reference: `${name} - ${role}`,
    })

    resetForm()
    setMode("list")

    } catch (failure) { setFormError(failure instanceof Error ? failure.message : "Não foi possível salvar") }
  }

  async function handleDelete(employee: Employee) {
    try {
    if (hardDelete) {
      // Hard delete - not recommended if has consumption history
      const hasConsumption = employeeConsumptions.some(c => c.employeeId === employee.id)
      if (hasConsumption) {
        setFormError("Não é possível excluir funcionário com histórico de consumo")
        return
      }
      // Would call removeEmployee here if implemented
      addAuditEntry({
        user: username || "sistema",
        action: "Funcionário removido",
        reference: `${employee.name}`,
      })
    } else {
      // Soft delete
      await updateEmployee(employee.id, { recordVersion: employee.recordVersion, active: false })
      addAuditEntry({
        user: username || "sistema",
        action: "Funcionário desativado",
        reference: `${employee.name}`,
      })
    }

    setDeleteConfirm(null)
    setHardDelete(false)

    } catch (failure) { setFormError(failure instanceof Error ? failure.message : "Alteração não salva") }
  }

  async function handleToggleActive(employee: Employee) {
    try {
    await updateEmployee(employee.id, { recordVersion: employee.recordVersion, active: !employee.active })
    addAuditEntry({
      user: username || "sistema",
      action: employee.active ? "Funcionário desativado" : "Funcionário reativado",
      reference: `${employee.name}`,
    })

    } catch (failure) { setFormError(failure instanceof Error ? failure.message : "Alteração não salva") }
  }

  function openEdit(employee: Employee) {
    setEditingEmployee(employee)
    setName(employee.name)
    setCpfValue(formatCPF(employee.cpf))
    setRole(employee.role)
    setConsumptionLimit(employee.consumptionLimit.toString())
    setLunchIncluded(employee.mealBenefit.lunchIncluded)
    setDinnerIncluded(employee.mealBenefit.dinnerIncluded)
    setSnackIncluded(employee.mealBenefit.snackIncluded)
    setFormError("")
    setMode("edit")
  }

  function getRoleLabel(roleValue: EmployeeRole): string {
    return EMPLOYEE_ROLES.find(r => r.value === roleValue)?.label || roleValue
  }

  function getConsumptionTotal(employeeId: string): number {
    const thisMonth = new Date().toISOString().slice(0, 7)
    return employeeConsumptions
      .filter(c => c.employeeId === employeeId && c.timestamp.startsWith(thisMonth))
      .reduce((sum, c) => sum + c.total, 0)
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={v => {
          if (!v) {
            onClose()
            setMode("list")
            resetForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Gerenciar Funcionários
            </DialogTitle>
            <DialogDescription>
              {mode === "list" && "Adicione, edite ou gerencie funcionários"}
              {mode === "add" && "Adicionar novo funcionário"}
              {mode === "edit" && "Editar funcionário"}
            </DialogDescription>
          </DialogHeader>

          {mode === "list" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    resetForm()
                    setMode("add")
                  }}
                >
                  <Plus className="h-4 w-4" /> Novo Funcionário
                </Button>

                <Select value={filter} onValueChange={(v: string) => setFilter(v as typeof filter)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                {filteredEmployees.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum funcionário encontrado
                  </p>
                ) : (
                  filteredEmployees.map(employee => {
                    const consumptionTotal = getConsumptionTotal(employee.id)
                    const consumptionPercent = (consumptionTotal / employee.consumptionLimit) * 100

                    return (
                      <div
                        key={employee.id}
                        className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3"
                      >
                        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{employee.name}</span>
                            {!employee.active && (
                              <Badge variant="outline" className="text-xs">
                                Inativo
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>CPF: {formatCPF(employee.cpf)}</span>
                            <span>•</span>
                            <span>{getRoleLabel(employee.role)}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-muted-foreground">
                              Limite: R$ {employee.consumptionLimit.toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span
                              className={
                                consumptionPercent > 90
                                  ? "text-red-600 font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              Consumido: R$ {consumptionTotal.toFixed(2)} ({consumptionPercent.toFixed(0)}%)
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {employee.mealBenefit.lunchIncluded && (
                              <Badge variant="secondary" className="text-xs">
                                Almoço
                              </Badge>
                            )}
                            {employee.mealBenefit.dinnerIncluded && (
                              <Badge variant="secondary" className="text-xs">
                                Jantar
                              </Badge>
                            )}
                            {employee.mealBenefit.snackIncluded && (
                              <Badge variant="secondary" className="text-xs">
                                Lanche
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(employee)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleActive(employee)}
                          >
                            {employee.active ? (
                              <UserX className="h-4 w-4 text-orange-600" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-green-600" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteConfirm(employee)
                              setHardDelete(false)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {(mode === "add" || mode === "edit") && (
            <div className="flex flex-col gap-4 overflow-y-auto pr-1">
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => {
                      setName(e.target.value)
                      setFormError("")
                    }}
                    placeholder="João da Silva"
                  />
                </div>

                <div>
                  <Label htmlFor="cpf">CPF *</Label>
                  <Input
                    id="cpf"
                    value={cpfValue}
                    onChange={e => handleCPFChange(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>

                <div>
                  <Label htmlFor="role">Cargo *</Label>
                  <Select value={role} onValueChange={(v: EmployeeRole) => setRole(v)}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="limit">Limite de Consumo Mensal (R$) *</Label>
                  <Input
                    id="limit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={consumptionLimit}
                    onChange={e => {
                      setConsumptionLimit(e.target.value)
                      setFormError("")
                    }}
                    placeholder="50.00"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="mb-3 block">Benefícios Incluídos</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="lunch"
                        checked={lunchIncluded}
                        onCheckedChange={v => setLunchIncluded(v as boolean)}
                      />
                      <Label htmlFor="lunch" className="cursor-pointer font-normal">
                        Almoço incluído
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="dinner"
                        checked={dinnerIncluded}
                        onCheckedChange={v => setDinnerIncluded(v as boolean)}
                      />
                      <Label htmlFor="dinner" className="cursor-pointer font-normal">
                        Jantar incluído
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="snack"
                        checked={snackIncluded}
                        onCheckedChange={v => setSnackIncluded(v as boolean)}
                      />
                      <Label htmlFor="snack" className="cursor-pointer font-normal">
                        Lanche incluído
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {mode === "list" ? (
              <Button onClick={onClose}>Fechar</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm()
                    setMode("list")
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={mode === "add" ? handleAdd : handleEdit}>
                  {mode === "add" ? "Adicionar" : "Salvar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {hardDelete
                ? `Tem certeza que deseja excluir permanentemente o funcionário "${deleteConfirm?.name}"? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja desativar o funcionário "${deleteConfirm?.name}"? Você poderá reativá-lo depois.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="hardDelete"
              checked={hardDelete}
              onCheckedChange={v => setHardDelete(v as boolean)}
              disabled={
                deleteConfirm
                  ? employeeConsumptions.some(c => c.employeeId === deleteConfirm.id)
                  : false
              }
            />
            <Label htmlFor="hardDelete" className="cursor-pointer font-normal text-sm">
              Excluir permanentemente (não recomendado)
            </Label>
          </div>

          {deleteConfirm &&
            employeeConsumptions.some(c => c.employeeId === deleteConfirm.id) &&
            hardDelete && (
              <p className="text-sm text-red-600">
                Este funcionário possui histórico de consumo e não pode ser excluído permanentemente.
              </p>
            )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHardDelete(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {hardDelete ? "Excluir" : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
