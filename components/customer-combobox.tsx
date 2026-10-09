"use client"
import { CnpjLookup } from "./cnpj-lookup"

import { useState, useMemo } from "react"
import { useApp } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Check, ChevronsUpDown, Plus, Building2, User } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import type { Customer } from "@/lib/store"
import { 
  normalizeDocument, formatCpfCnpj,
  validateCpfCnpj, 
  getDocumentType 
} from "@/lib/utils/cpf-cnpj-validator"

interface CustomerComboboxProps {
  purpose?: "guest" | "payer" | "supplier"
  value?: string
  onChange: (customerId: string, customerName: string) => void
  allowCreate?: boolean
  filterActive?: boolean
  className?: string
  error?: string
}

interface QuickCustomerFormData {
  name: string
  cpfCnpj: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
}

const emptyQuickForm: QuickCustomerFormData = {
  name: "",
  cpfCnpj: "",
  email: "",
  phone: "",
}

export function CustomerCombobox({
  purpose = "payer", value,
  onChange,
  allowCreate = true,
  filterActive = true,
  className,
  error,
}: CustomerComboboxProps) {
  const { customers, addCustomer } = useApp()
  const { can } = useAuth()
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [quickFormData, setQuickFormData] = useState<QuickCustomerFormData>(emptyQuickForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const filteredCustomers = useMemo(() => {
    let list = (filterActive ? customers.filter(c => c.active) : [...customers]).filter(c => purpose === "guest" ? getDocumentType(c.cpfCnpj) === "CPF" : purpose === "supplier" || (c.roles ?? ["payer"]).includes("payer"))
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.cpfCnpj.includes(normalizeDocument(term))
      )
    }
    
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [customers, filterActive, searchTerm, purpose])

  const selectedCustomer = customers.find((c) => c.id === value)

  const validateQuickForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!quickFormData.name.trim()) {
      newErrors.name = "Nome é obrigatório"
    }

    if (!quickFormData.cpfCnpj.trim()) {
      newErrors.cpfCnpj = "CPF/CNPJ é obrigatório"
    } else if (!validateCpfCnpj(quickFormData.cpfCnpj)) {
      newErrors.cpfCnpj = "CPF/CNPJ inválido"
    }

    // Check for duplicate CPF/CNPJ
    const cleanCpfCnpj = normalizeDocument(quickFormData.cpfCnpj)
    const duplicate = customers.find(
      (c) => normalizeDocument(c.cpfCnpj) === cleanCpfCnpj
    )
    if (duplicate) {
      newErrors.cpfCnpj = "CPF/CNPJ já cadastrado"
    }

    setFormErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleOpenQuickCreate = () => {
    setQuickFormData(emptyQuickForm)
    setFormErrors({})
    setIsDialogOpen(true)
    setOpen(false)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setQuickFormData(emptyQuickForm)
    setFormErrors({})
  }

  const handleQuickCreate = async () => {
    if (pending) return
    if (!validateQuickForm()) {
      return
    }

    setPending(true)
    try {
      const customerData = {
        roles: purpose === "guest" ? ["guest", "payer"] : [purpose], name: quickFormData.name,
        cpfCnpj: normalizeDocument(quickFormData.cpfCnpj),
        email: quickFormData.email || undefined,
        phone: quickFormData.phone || undefined,
        address: quickFormData.address,
        city: quickFormData.city,
        state: quickFormData.state,
        zipCode: quickFormData.zipCode,
        active: true,
      }

      const newCustomer = await addCustomer(customerData as Customer)
      onChange(newCustomer.id, newCustomer.name)
      handleCloseDialog()
    } catch (error) {
      console.error("Error creating customer:", error)
      setFormErrors({ submit: error instanceof Error ? error.message : "Erro ao criar pessoa" })
    }
    finally { setPending(false) }
  }

  const handleCpfCnpjChange = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9./-]/g, "")
    setQuickFormData({ ...quickFormData, cpfCnpj: cleaned })
    
    if (formErrors.cpfCnpj) {
      setFormErrors({ ...formErrors, cpfCnpj: "" })
    }
  }

  const handleCpfCnpjBlur = () => {
    if (quickFormData.cpfCnpj) {
      const formatted = formatCpfCnpj(quickFormData.cpfCnpj)
      setQuickFormData({ ...quickFormData, cpfCnpj: formatted })
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("justify-between", className, error && "border-red-500")}
          >
            {selectedCustomer ? (
              <span className="flex items-center gap-2">
                {getDocumentType(selectedCustomer.cpfCnpj) === "CPF" ? (
                  <User className="h-4 w-4 text-blue-500" />
                ) : (
                  <Building2 className="h-4 w-4 text-purple-500" />
                )}
                {selectedCustomer.name}
              </span>
            ) : (
              "Selecione um cliente..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput
              placeholder="Buscar cliente..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              <CommandEmpty>
                {searchTerm ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
              </CommandEmpty>
              <CommandGroup>
                {filteredCustomers.map((customer) => {
                  const docType = getDocumentType(customer.cpfCnpj)
                  return (
                    <CommandItem
                      key={customer.id}
                      value={customer.id}
                      onSelect={() => {
                        onChange(customer.id, customer.name)
                        setOpen(false)
                        setSearchTerm("")
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === customer.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        {docType === "CPF" ? (
                          <User className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Building2 className="h-4 w-4 text-purple-500" />
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium">{customer.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatCpfCnpj(customer.cpfCnpj)}
                          </span>
                        </div>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              {allowCreate && can("customers.create") && (
                <CommandGroup>
                  <CommandItem onSelect={handleOpenQuickCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar novo cliente
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Quick Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastro Rápido de Cliente</DialogTitle>
            <DialogDescription>
              Preencha os dados básicos do cliente
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quick-name">
                Nome / Razão Social <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quick-name"
                value={quickFormData.name}
                onChange={(e) =>
                  setQuickFormData({ ...quickFormData, name: e.target.value })
                }
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-sm text-red-500">{formErrors.name}</p>
              )}
            </div>

            <div className="grid gap-2">
              <CnpjLookup document={quickFormData.cpfCnpj} onApply={company => setQuickFormData({ ...quickFormData, ...company })} /><Label htmlFor="quick-cpfCnpj">
                CPF/CNPJ <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quick-cpfCnpj"
                value={quickFormData.cpfCnpj}
                onChange={(e) => handleCpfCnpjChange(e.target.value)}
                onBlur={handleCpfCnpjBlur}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className={formErrors.cpfCnpj ? "border-red-500" : ""}
              />
              {formErrors.cpfCnpj && (
                <p className="text-sm text-red-500">{formErrors.cpfCnpj}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quick-email">Email</Label>
              <Input
                id="quick-email"
                type="email"
                value={quickFormData.email}
                onChange={(e) =>
                  setQuickFormData({ ...quickFormData, email: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quick-phone">Telefone</Label>
              <Input
                id="quick-phone"
                value={quickFormData.phone}
                onChange={(e) =>
                  setQuickFormData({ ...quickFormData, phone: e.target.value })
                }
                placeholder="(00) 00000-0000"
              />
            </div>

            {formErrors.submit && (
              <p className="text-sm text-red-500">{formErrors.submit}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button disabled={pending} onClick={handleQuickCreate}>Criar Cliente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
