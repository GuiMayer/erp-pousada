"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
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
import { Shield, Save, RotateCcw, Building2, Clock, Percent, Phone } from "lucide-react"
import { toast } from "sonner"
import type { SystemSettings } from "@/lib/store"
import { initialSystemSettings } from "@/lib/store"

export function AdminTab() {
  const { systemSettings, updateSystemSettings, addAuditEntry } = useApp()
  const { user } = useAuth()
  
  const [formData, setFormData] = useState<SystemSettings>(systemSettings)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)

  // Sync with context when systemSettings changes
  useEffect(() => {
    setFormData(systemSettings)
    setIsDirty(false)
  }, [systemSettings])

  // Validation functions
  const validatePousadaName = (value: string): string | null => {
    if (!value || value.trim().length === 0) {
      return "Nome da pousada é obrigatório"
    }
    if (value.trim().length < 3) {
      return "Nome deve ter pelo menos 3 caracteres"
    }
    return null
  }

  const validateTime = (value: string): string | null => {
    if (!value) return "Horário é obrigatório"
    if (!/^\d{2}:\d{2}$/.test(value)) {
      return "Formato inválido (use HH:mm)"
    }
    return null
  }

  const validateDiscountCeiling = (value: number): string | null => {
    if (value < 0 || value > 100) {
      return "Valor deve estar entre 0 e 100"
    }
    return null
  }

  const validateEmail = (value: string): string | null => {
    if (!value) return null // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      return "Email inválido"
    }
    return null
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    const nameError = validatePousadaName(formData.pousadaName)
    if (nameError) newErrors.pousadaName = nameError

    const checkInError = validateTime(formData.checkInTime)
    if (checkInError) newErrors.checkInTime = checkInError

    const checkOutError = validateTime(formData.checkOutTime)
    if (checkOutError) newErrors.checkOutTime = checkOutError

    const discountError = validateDiscountCeiling(formData.discountCeiling)
    if (discountError) newErrors.discountCeiling = discountError

    if (formData.contactEmail) {
      const emailError = validateEmail(formData.contactEmail)
      if (emailError) newErrors.contactEmail = emailError
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFieldChange = (field: keyof SystemSettings, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const getChangedFields = (): string[] => {
    const changed: string[] = []
    const fieldLabels: Record<string, string> = {
      pousadaName: "Nome da Pousada",
      checkInTime: "Horário de Check-in",
      checkOutTime: "Horário de Check-out",
      discountCeiling: "Teto de Desconto",
      contactPhone: "Telefone",
      contactEmail: "Email",
      address: "Endereço",
    }

    Object.keys(fieldLabels).forEach(key => {
      const field = key as keyof SystemSettings
      if (formData[field] !== systemSettings[field]) {
        changed.push(fieldLabels[field])
      }
    })

    return changed
  }

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Corrija os erros antes de salvar")
      return
    }

    setIsSaving(true)
    try {
      const changedFields = getChangedFields()
      
      await updateSystemSettings(formData)
      
      // Register audit entry
      if (changedFields.length > 0) {
        await addAuditEntry({
          user: user?.username || "sistema",
          action: "Configurações atualizadas",
          reference: `Campos alterados: ${changedFields.join(", ")}`,
        })
      }

      toast.success("Configurações salvas com sucesso")
      setIsDirty(false)
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error("Erro ao salvar configurações")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRestoreDefaults = async () => {
    setShowRestoreDialog(false)
    setIsSaving(true)
    
    try {
      await updateSystemSettings(initialSystemSettings)
      
      await addAuditEntry({
        user: user?.username || "sistema",
        action: "Configurações restauradas",
        reference: "Valores padrão restaurados",
      })

      toast.success("Configurações restauradas para os valores padrão")
      setFormData(initialSystemSettings)
      setIsDirty(false)
      setErrors({})
    } catch (error) {
      console.error("Error restoring defaults:", error)
      toast.error("Erro ao restaurar configurações")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">
          Administração do Sistema
        </h2>
      </div>

      {/* Informações da Pousada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4" />
            Informações da Pousada
          </CardTitle>
          <CardDescription>
            Dados básicos da sua pousada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pousadaName">
              Nome da Pousada <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pousadaName"
              value={formData.pousadaName}
              onChange={(e) => handleFieldChange("pousadaName", e.target.value)}
              placeholder="Ex: Pousada Sol & Mar"
              className={errors.pousadaName ? "border-destructive" : ""}
            />
            {errors.pousadaName && (
              <p className="text-sm text-destructive">{errors.pousadaName}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Horários de Check-in/Check-out */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4" />
            Horários de Check-in/Check-out
          </CardTitle>
          <CardDescription>
            Defina os horários padrão para entrada e saída
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkInTime">
                Horário de Check-in <span className="text-destructive">*</span>
              </Label>
              <Input
                id="checkInTime"
                type="time"
                value={formData.checkInTime}
                onChange={(e) => handleFieldChange("checkInTime", e.target.value)}
                className={errors.checkInTime ? "border-destructive" : ""}
              />
              {errors.checkInTime && (
                <p className="text-sm text-destructive">{errors.checkInTime}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkOutTime">
                Horário de Check-out <span className="text-destructive">*</span>
              </Label>
              <Input
                id="checkOutTime"
                type="time"
                value={formData.checkOutTime}
                onChange={(e) => handleFieldChange("checkOutTime", e.target.value)}
                className={errors.checkOutTime ? "border-destructive" : ""}
              />
              {errors.checkOutTime && (
                <p className="text-sm text-destructive">{errors.checkOutTime}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Políticas Comerciais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="size-4" />
            Políticas Comerciais
          </CardTitle>
          <CardDescription>
            Configure limites e regras de negócio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="discountCeiling">
              Teto de Desconto (%) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="discountCeiling"
              type="number"
              min="0"
              max="100"
              value={formData.discountCeiling}
              onChange={(e) => handleFieldChange("discountCeiling", Number(e.target.value))}
              className={errors.discountCeiling ? "border-destructive" : ""}
            />
            {errors.discountCeiling && (
              <p className="text-sm text-destructive">{errors.discountCeiling}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Desconto máximo permitido sem aprovação de supervisor
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dados de Contato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="size-4" />
            Dados de Contato
          </CardTitle>
          <CardDescription>
            Informações de contato da pousada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Telefone</Label>
            <Input
              id="contactPhone"
              type="tel"
              value={formData.contactPhone || ""}
              onChange={(e) => handleFieldChange("contactPhone", e.target.value)}
              placeholder="(11) 98765-4321"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail || ""}
              onChange={(e) => handleFieldChange("contactEmail", e.target.value)}
              placeholder="contato@pousada.com.br"
              className={errors.contactEmail ? "border-destructive" : ""}
            />
            {errors.contactEmail && (
              <p className="text-sm text-destructive">{errors.contactEmail}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Textarea
              id="address"
              value={formData.address || ""}
              onChange={(e) => handleFieldChange("address", e.target.value)}
              placeholder="Rua das Praias, 123 - Praia Grande, SP"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button 
          onClick={handleSave} 
          disabled={!isDirty || isSaving || Object.keys(errors).length > 0}
          className="gap-2"
        >
          <Save className="size-4" />
          {isSaving ? "Salvando..." : "Salvar Alterações"}
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => setShowRestoreDialog(true)}
          disabled={isSaving}
          className="gap-2"
        >
          <RotateCcw className="size-4" />
          Restaurar Padrões
        </Button>
      </div>

      {/* Restore Defaults Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar Configurações Padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá restaurar todas as configurações para os valores padrão do sistema.
              Todas as suas customizações serão perdidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDefaults}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
