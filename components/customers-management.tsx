"use client"
import { PermissionGate } from "@/components/permission-gate"

import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Search, Building2, User, History, DollarSign, Calendar, Trash2 } from "lucide-react"
import type { Customer, AccountReceivable } from "@/lib/store"
import { 
  formatCpfCnpj, 
  validateCpfCnpj, 
  getDocumentType 
} from "@/lib/utils/cpf-cnpj-validator"

interface CustomerFormData {
  recordVersion?: number
  name: string
  cpfCnpj: string
  email: string
  phone: string
  phone2: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
  birthDate: string
  notes: string
  active: boolean
}

const emptyForm: CustomerFormData = {
  name: "",
  cpfCnpj: "",
  email: "",
  phone: "",
  phone2: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "Brasil",
  birthDate: "",
  notes: "",
  active: true,
}

export default function CustomersManagement() {
  const { customers, addCustomer, updateCustomer, removeCustomer, accountsReceivable, addAuditEntry } = useApp()
  const { username } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.cpfCnpj.includes(searchTerm)
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && customer.active) ||
      (filterStatus === "inactive" && !customer.active)
    return matchesSearch && matchesStatus
  })

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Nome é obrigatório"
    }

    if (!formData.cpfCnpj.trim()) {
      newErrors.cpfCnpj = "CPF/CNPJ é obrigatório"
    } else if (!validateCpfCnpj(formData.cpfCnpj)) {
      newErrors.cpfCnpj = "CPF/CNPJ inválido"
    }

    // Check for duplicate CPF/CNPJ
    const cleanCpfCnpj = formData.cpfCnpj.replace(/\D/g, "")
    const duplicate = customers.find(
      (c) => c.cpfCnpj.replace(/\D/g, "") === cleanCpfCnpj && c.id !== editingId
    )
    if (duplicate) {
      newErrors.cpfCnpj = "CPF/CNPJ já cadastrado"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleOpenDialog = (customer?: Customer) => {
    if (customer) {
      setEditingId(customer.id)
      setFormData({
        recordVersion: customer.recordVersion,
        name: customer.name,
        cpfCnpj: customer.cpfCnpj,
        email: customer.email || "",
        phone: customer.phone || "",
        phone2: customer.phone2 || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        zipCode: customer.zipCode || "",
        country: customer.country || "Brasil",
        birthDate: customer.birthDate || "",
        notes: customer.notes || "",
        active: customer.active,
      })
    } else {
      setEditingId(null)
      setFormData(emptyForm)
    }
    setErrors({})
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingId(null)
    setFormData(emptyForm)
    setErrors({})
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    try {
      const customerData = {
        ...formData,
        cpfCnpj: formData.cpfCnpj.replace(/\D/g, ""), // Store without formatting
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        phone2: formData.phone2 || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zipCode: formData.zipCode || undefined,
        country: formData.country || undefined,
        birthDate: formData.birthDate || undefined,
        notes: formData.notes || undefined,
      }

      const auditUser = username || "sistema"

      if (editingId) {
        // Find original customer to detect status changes
        const originalCustomer = customers.find(c => c.id === editingId)
        const statusChanged = originalCustomer && originalCustomer.active !== formData.active
        
        await updateCustomer(editingId, customerData)
        
        // Log specific audit entry based on what changed
        if (statusChanged) {
          const action = formData.active ? "Cliente ativado" : "Cliente desativado"
          await addAuditEntry({
            user: auditUser,
            action,
            reference: formData.name
          })
        } else {
          // Log generic edit if no status change
          const docType = getDocumentType(formData.cpfCnpj)
          await addAuditEntry({
            user: auditUser,
            action: "Cliente editado",
            reference: `${formData.name} (${docType})`
          })
        }
      } else {
        await addCustomer(customerData as Customer)
        
        // Log audit entry for customer creation
        const docType = getDocumentType(formData.cpfCnpj)
        const formattedDoc = formatCpfCnpj(formData.cpfCnpj)
        await addAuditEntry({
          user: auditUser,
          action: "Cliente adicionado",
          reference: `${formData.name} (${formattedDoc}) - ${docType}`
        })
      }

      handleCloseDialog()
    } catch (error) {
      console.error("Error saving customer:", error)
      setErrors({ submit: "Erro ao salvar cliente" })
    }
  }

  const handleCpfCnpjChange = (value: string) => {
    // Allow only numbers and formatting characters
    const cleaned = value.replace(/[^\d./-]/g, "")
    setFormData({ ...formData, cpfCnpj: cleaned })
    
    // Clear error when user starts typing
    if (errors.cpfCnpj) {
      setErrors({ ...errors, cpfCnpj: "" })
    }
  }

  const handleCpfCnpjBlur = () => {
    // Format on blur
    if (formData.cpfCnpj) {
      const formatted = formatCpfCnpj(formData.cpfCnpj)
      setFormData({ ...formData, cpfCnpj: formatted })
    }
  }

  const handleOpenHistory = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsHistoryDialogOpen(true)
  }

  const getCustomerAccountsReceivable = (customerId: string) => {
    return accountsReceivable.filter(ar => ar.customerId === customerId)
  }

  const handleDelete = async (customer: Customer) => {
    const auditUser = username || "sistema"
    const linkedAccounts = getCustomerAccountsReceivable(customer.id)

    if (linkedAccounts.length > 0) {
      if (!confirm(`Cliente possui ${linkedAccounts.length} conta(s) vinculada(s). Deseja desativar o cadastro?`)) {
        return
      }

      await updateCustomer(customer.id, { active: false })
      await addAuditEntry({
        user: auditUser,
        action: "Cliente desativado",
        reference: `${customer.name} (${linkedAccounts.length} conta(s) vinculada(s))`,
      })
      return
    }

    if (!confirm(`Tem certeza que deseja excluir o cliente "${customer.name}"?`)) {
      return
    }

    await removeCustomer(customer.id)
    await addAuditEntry({
      user: auditUser,
      action: "Cliente removido",
      reference: customer.name,
    })
  }

  const getStatusBadge = (status: AccountReceivable["status"]) => {
    const variants = {
      pendente: "default",
      pago: "default",
      vencido: "destructive",
      cancelado: "secondary"
    } as const

    const labels = {
      pendente: "Pendente",
      pago: "Pago",
      vencido: "Vencido",
      cancelado: "Cancelado"
    }

    return (
      <Badge variant={variants[status]} className={status === "pago" ? "bg-green-500" : ""}>
        {labels[status]}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
          <p className="text-muted-foreground">
            Gerencie seus clientes (pessoas físicas e jurídicas)
          </p>
        </div>
        <PermissionGate permission="customers.create"><Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button></PermissionGate>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF/CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => {
                const docType = getDocumentType(customer.cpfCnpj)
                return (
                  <TableRow key={customer.id}>
                    <TableCell>
                      {docType === "CPF" ? (
                        <User className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Building2 className="h-4 w-4 text-purple-500" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCpfCnpj(customer.cpfCnpj)}
                    </TableCell>
                    <TableCell>{customer.phone || "-"}</TableCell>
                    <TableCell>{customer.email || "-"}</TableCell>
                    <TableCell>
                      {customer.active ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenHistory(customer)}
                          title="Ver histórico"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <PermissionGate permission="customers.edit"><Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(customer)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button></PermissionGate>
                        <PermissionGate permission="customers.delete"><Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(customer)}
                          title={getCustomerAccountsReceivable(customer.id).length > 0 ? "Desativar" : "Excluir"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button></PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Atualize as informações do cliente"
                : "Preencha os dados do novo cliente"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Info */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nome / Razão Social <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cpfCnpj">
                  CPF/CNPJ <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cpfCnpj"
                  value={formData.cpfCnpj}
                  onChange={(e) => handleCpfCnpjChange(e.target.value)}
                  onBlur={handleCpfCnpjBlur}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className={errors.cpfCnpj ? "border-red-500" : ""}
                />
                {errors.cpfCnpj && (
                  <p className="text-sm text-red-500">{errors.cpfCnpj}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone2">Telefone 2</Label>
                  <Input
                    id="phone2"
                    value={formData.phone2}
                    onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="zipCode">CEP</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    placeholder="00000-000"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="country">País</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>
            </div>

            {/* Notes and Status */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Cliente ativo
                </Label>
              </div>
            </div>

            {errors.submit && (
              <p className="text-sm text-red-500">{errors.submit}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico do Cliente</DialogTitle>
            <DialogDescription>
              {selectedCustomer && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {getDocumentType(selectedCustomer.cpfCnpj) === "CPF" ? (
                      <User className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Building2 className="h-4 w-4 text-purple-500" />
                    )}
                    <span className="font-semibold">{selectedCustomer.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatCpfCnpj(selectedCustomer.cpfCnpj)}
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    Total de Contas
                  </div>
                  <div className="text-2xl font-bold">
                    {getCustomerAccountsReceivable(selectedCustomer.id).length}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    Valor Pendente
                  </div>
                  <div className="text-2xl font-bold">
                    R$ {getCustomerAccountsReceivable(selectedCustomer.id)
                      .filter(ar => ar.status === "pendente" || ar.status === "vencido")
                      .reduce((sum, ar) => sum + ar.value, 0)
                      .toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    Total Pago
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    R$ {getCustomerAccountsReceivable(selectedCustomer.id)
                      .filter(ar => ar.status === "pago")
                      .reduce((sum, ar) => sum + ar.value, 0)
                      .toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Contas a Receber</h3>
                {getCustomerAccountsReceivable(selectedCustomer.id).length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getCustomerAccountsReceivable(selectedCustomer.id)
                          .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
                          .map((ar) => (
                            <TableRow key={ar.id}>
                              <TableCell>{ar.description}</TableCell>
                              <TableCell>R$ {ar.value.toFixed(2)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {new Date(ar.dueDate).toLocaleDateString("pt-BR")}
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(ar.status)}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-md">
                    Nenhuma conta a receber encontrada para este cliente
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
