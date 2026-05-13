"use client"

import { useState } from "react"
import { useApp } from "@/lib/app-context"
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
import { Plus, Pencil, Search, Building2, User } from "lucide-react"
import type { Customer } from "@/lib/store"
import { 
  formatCpfCnpj, 
  validateCpfCnpj, 
  getDocumentType 
} from "@/lib/utils/cpf-cnpj-validator"

interface CustomerFormData {
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
  const { customers, addCustomer, updateCustomer } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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

      if (editingId) {
        await updateCustomer(editingId, customerData)
      } else {
        await addCustomer(customerData as Customer)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
          <p className="text-muted-foreground">
            Gerencie seus clientes (pessoas físicas e jurídicas)
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(customer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
    </div>
  )
}
