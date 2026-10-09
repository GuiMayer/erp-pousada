"use client"

import { ruleSchema } from "@/lib/notification-policy"
import { PROFILES, effectivePermissions, type PermissionOverrides } from "@/lib/permissions"
import { UserPermissionsEditor } from "./user-permissions-editor"
import { useState, useEffect, useRef } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
import { Shield, Save, RotateCcw, Building2, Clock, Percent, Phone, Bell, Plus, Pencil, UserCog } from "lucide-react"
import { toast } from "sonner"
import type { SystemSettings, User, UserRole } from "@/lib/store"
import { initialSystemSettings } from "@/lib/store"

type UserFormData = {
  username: string
  password: string
  role: UserRole
  accessProfile: string
  permissionOverrides: PermissionOverrides
  fullName: string
  email: string
  active: boolean
}

const emptyUserForm: UserFormData = {
  username: "",
  password: "",
  role: "operador",
  accessProfile: "recepcao",
  permissionOverrides: {},
  fullName: "",
  email: "",
  active: true,
}

export function AdminTab() {
  const { systemSettings, updateSystemSettings, users, addUser, updateUser, addAuditEntry } = useApp()
  const { username, can } = useAuth()
  const [isUserSaving, setUserSaving] = useState(false)

  const [formData, setFormData] = useState<SystemSettings>(systemSettings)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState<UserFormData>(emptyUserForm)
  const [userErrors, setUserErrors] = useState<Record<string, string>>({})

  // Use ref to track if we should sync with context
  const shouldSyncRef = useRef(true)

  // Sync with context when systemSettings changes (only if not currently editing)
  useEffect(() => {
    // Only sync if we're not in the middle of editing
    if (shouldSyncRef.current) {
      setFormData(systemSettings)
      setIsDirty(false)
    }
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

  const validateCNPJ = (value: string): string | null => {
    if (!value) return null // Optional field
    const cnpjNumbers = value.replace(/\D/g, '')
    if (cnpjNumbers.length > 0 && cnpjNumbers.length !== 14) {
      return "CNPJ deve ter 14 dígitos"
    }
    return null
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    const nameError = validatePousadaName(formData.pousadaName)
    if (nameError) newErrors.pousadaName = nameError

    if (!ruleSchema.safeParse(formData.notificationRules ?? {}).success) newErrors.notificationRules = "Revise os limites: crítico deve ser mais grave que aviso."
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

    if (formData.cnpj) {
      const cnpjError = validateCNPJ(formData.cnpj)
      if (cnpjError) newErrors.cnpj = cnpjError
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFieldChange = (field: keyof SystemSettings, value: string | number | boolean | Record<string, number>) => {
    // Prevent syncing with context while editing
    shouldSyncRef.current = false
    
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
      cnpj: "CNPJ",
      razaoSocial: "Razão Social",
      inscricaoEstadual: "Inscrição Estadual",
      logoUrl: "Logo",
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
          user: username || "sistema",
          action: "Configurações atualizadas",
          reference: `Campos alterados: ${changedFields.join(", ")}`,
        })
      }

      toast.success("Configurações salvas com sucesso")
      setIsDirty(false)
      // Re-enable syncing after successful save
      shouldSyncRef.current = true
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
      // Re-enable syncing before restoring
      shouldSyncRef.current = true
      await updateSystemSettings({ ...initialSystemSettings, recordVersion: formData.recordVersion })
      
      await addAuditEntry({
        user: username || "sistema",
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

  const openUserDialog = (userToEdit?: User) => {
    setEditingUser(userToEdit ?? null)
    setUserForm(userToEdit ? {
      username: userToEdit.username,
      password: "",
      role: userToEdit.role,
      accessProfile: userToEdit.accessProfile || (userToEdit.role === "supervisor" ? "administrador" : "operador_legado"),
      permissionOverrides: userToEdit.permissionOverrides ?? {},
      fullName: userToEdit.fullName,
      email: userToEdit.email ?? "",
      active: userToEdit.active,
    } : emptyUserForm)
    setUserErrors({})
    setIsUserDialogOpen(true)
  }

  const closeUserDialog = () => {
    setIsUserDialogOpen(false)
    setEditingUser(null)
    setUserForm(emptyUserForm)
    setUserErrors({})
  }

  const validateUserForm = () => {
    const nextErrors: Record<string, string> = {}
    const trimmedUsername = userForm.username.trim()
    const trimmedFullName = userForm.fullName.trim()

    if (!trimmedUsername) nextErrors.username = "Usuário e obrigatorio"
    if (!trimmedFullName) nextErrors.fullName = "Nome completo e obrigatorio"
    if (!editingUser && !userForm.password.trim()) nextErrors.password = "Senha inicial e obrigatoria"
    if (userForm.password && (userForm.password.length < 12 || new TextEncoder().encode(userForm.password).length > 72)) nextErrors.password = "Use pelo menos 12 caracteres e no máximo 72 bytes"
    if (userForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) nextErrors.email = "Email invalido"

    const duplicate = users.find(userItem =>
      userItem.username.toLowerCase() === trimmedUsername.toLowerCase() && userItem.id !== editingUser?.id
    )
    if (duplicate) nextErrors.username = "Usuário ja cadastrado"

    setUserErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSaveUser = async () => {
    if (isUserSaving || !validateUserForm()) return
    setUserSaving(true)
    try {

    const auditUser = username || "sistema"
    const userData = {
      username: userForm.username.trim(),
      role: (["administrador", "supervisor"].includes(userForm.accessProfile) ? "supervisor" : "operador") as UserRole,
      accessProfile: userForm.accessProfile,
      permissionOverrides: userForm.permissionOverrides,
      ...(editingUser ? { recordVersion: editingUser.recordVersion } : {}),
      fullName: userForm.fullName.trim(),
      email: userForm.email.trim() || undefined,
      active: userForm.active,
    }

    if (editingUser) {
      await updateUser(editingUser.id, userForm.password.trim()
        ? { ...userData, password: userForm.password }
        : userData
      )
      await addAuditEntry({
        user: auditUser,
        action: userForm.active ? "Usuário editado" : "Usuário desativado",
        reference: userData.username,
      })
    } else {
      await addUser({
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...userData,
        password: userForm.password,
        createdAt: new Date().toISOString(),
        createdBy: auditUser,
      })
      await addAuditEntry({
        user: auditUser,
        action: "Usuário criado",
        reference: userData.username,
      })
    }

    closeUserDialog()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o usuário") }
    finally { setUserSaving(false) }
  }

  const handleDeactivateUser = async (targetUser: User) => {
    if (!targetUser.active) return
    if (!confirm(`Desativar o usuário "${targetUser.username}"?`)) return

    const auditUser = username || "sistema"
    try {
    await updateUser(targetUser.id, { active: false, recordVersion: targetUser.recordVersion })
    await addAuditEntry({
      user: auditUser,
      action: "Usuário desativado",
      reference: targetUser.username,
    })
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível desativar o usuário") }
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

      {can("systemSettings.edit") && <>
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

      {/* Informações de Contato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="size-4" />
            Informações de Contato
          </CardTitle>
          <CardDescription>
            Dados de contato da pousada para comunicação com hóspedes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contactPhone">
              Telefone
            </Label>
            <Input
              id="contactPhone"
              value={formData.contactPhone || ""}
              onChange={(e) => handleFieldChange("contactPhone", e.target.value)}
              placeholder="Ex: (11) 98765-4321"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">
              E-mail
            </Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail || ""}
              onChange={(e) => handleFieldChange("contactEmail", e.target.value)}
              placeholder="Ex: contato@pousada.com.br"
              className={errors.contactEmail ? "border-destructive" : ""}
            />
            {errors.contactEmail && (
              <p className="text-sm text-destructive">{errors.contactEmail}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">
              Endereço
            </Label>
            <Textarea
              id="address"
              value={formData.address || ""}
              onChange={(e) => handleFieldChange("address", e.target.value)}
              placeholder="Ex: Rua das Praias, 123 - Praia Grande, SP"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Informações Fiscais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4" />
            Informações Fiscais
          </CardTitle>
          <CardDescription>
            Dados fiscais para emissão de relatórios e documentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="razaoSocial">
              Razão Social
            </Label>
            <Input
              id="razaoSocial"
              value={formData.razaoSocial || ""}
              onChange={(e) => handleFieldChange("razaoSocial", e.target.value)}
              placeholder="Ex: Pousada Sol & Mar Ltda"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj">
              CNPJ
            </Label>
            <Input
              id="cnpj"
              value={formData.cnpj || ""}
              onChange={(e) => handleFieldChange("cnpj", e.target.value)}
              placeholder="Ex: 12.345.678/0001-90"
              className={errors.cnpj ? "border-destructive" : ""}
            />
            {errors.cnpj && (
              <p className="text-sm text-destructive">{errors.cnpj}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="inscricaoEstadual">
              Inscrição Estadual
            </Label>
            <Input
              id="inscricaoEstadual"
              value={formData.inscricaoEstadual || ""}
              onChange={(e) => handleFieldChange("inscricaoEstadual", e.target.value)}
              placeholder="Ex: 123.456.789.012"
            />
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

      {/* Configurações de Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4" />
            Notificações
          </CardTitle>
          <CardDescription>
            Configure alertas e lembretes automáticos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifyCheckInReminder">Lembrete de Check-in</Label>
              <p className="text-sm text-muted-foreground">
                Notificar sobre check-ins programados para hoje
              </p>
            </div>
            <Switch
              id="notifyCheckInReminder"
              checked={formData.notifyCheckInReminder ?? true}
              onCheckedChange={(checked) => handleFieldChange("notifyCheckInReminder", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifyCheckOutReminder">Lembrete de Check-out</Label>
              <p className="text-sm text-muted-foreground">
                Notificar sobre check-outs programados para hoje
              </p>
            </div>
            <Switch
              id="notifyCheckOutReminder"
              checked={formData.notifyCheckOutReminder ?? true}
              onCheckedChange={(checked) => handleFieldChange("notifyCheckOutReminder", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifyLowStock">Estoque Baixo</Label>
              <p className="text-sm text-muted-foreground">
                Alertar quando produtos estiverem com estoque baixo
              </p>
            </div>
            <Switch
              id="notifyLowStock"
              checked={formData.notifyLowStock ?? true}
              onCheckedChange={(checked) => handleFieldChange("notifyLowStock", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifyPendingPayments">Pagamentos Pendentes</Label>
              <p className="text-sm text-muted-foreground">
                Notificar sobre reservas com pagamentos pendentes
              </p>
            </div>
            <Switch
              id="notifyPendingPayments"
              checked={formData.notifyPendingPayments ?? true}
              onCheckedChange={(checked) => handleFieldChange("notifyPendingPayments", checked)}
            />
          </div>
          <Separator />
          <p className="text-sm font-medium">Limites dos alertas operacionais</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries({ stockCriticalLevel: "Estoque crítico (% do mínimo)", stockLowLevel: "Estoque baixo (% do mínimo)", cashDifferenceWarning: "Diferença de caixa: aviso (R$)", cashDifferenceCritical: "Diferença de caixa: crítico (R$)" }).map(([key, label]) => <div key={key} className="space-y-1">
              <Label htmlFor={`rule-${key}`}>{label}</Label>
              <Input id={`rule-${key}`} type="number" min="0" step="0.1" value={formData.notificationRules?.[key] ?? (ruleSchema.parse({}) as Record<string, number>)[key]} onChange={e => handleFieldChange("notificationRules", { ...formData.notificationRules, [key]: Number(e.target.value) })} />
            </div>)}
          </div>
          {errors.notificationRules && <p role="alert" className="text-sm text-destructive">{errors.notificationRules}</p>}
        </CardContent>
      </Card>

      </>}
      {can("users.manage") && <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-4" />
            Usuários
          </CardTitle>
          <CardDescription>
            Defina perfis por setor e exceções individuais. Alterações são registradas automaticamente na auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2" disabled={!can("users.create")} onClick={() => openUserDialog()}>
              <Plus className="size-4" />
              Novo Usuário
            </Button>
          </div>

          <div className="rounded-md border divide-y">
            {users.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhum usuário cadastrado.</div>
            ) : users.map(userItem => (
              <div key={userItem.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{userItem.fullName}</span>
                    <Badge variant={userItem.active ? "default" : "secondary"}>
                      {userItem.active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Badge variant="outline">{PROFILES[userItem.accessProfile || (userItem.role === "supervisor" ? "administrador" : "operador_legado")]?.label === "Restaurante" ? "Módulo arquivado" : PROFILES[userItem.accessProfile || (userItem.role === "supervisor" ? "administrador" : "operador_legado")]?.label}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {userItem.username}{userItem.email ? ` - ${userItem.email}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" aria-label={`Editar ${userItem.username}`} disabled={!can("users.edit")} onClick={() => openUserDialog(userItem)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!userItem.active || !can("users.edit")}
                    onClick={() => handleDeactivateUser(userItem)}
                  >
                    Desativar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>}

      <Separator />

      {can("systemSettings.edit") && <>
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
      </AlertDialog></>}

      <Dialog open={isUserDialogOpen} onOpenChange={(open) => { if (!open) closeUserDialog() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            <DialogDescription>
              Defina os dados de acesso e o perfil operacional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="userUsername">Usuário</Label>
                <Input
                  id="userUsername"
                  value={userForm.username}
                  onChange={(event) => setUserForm(prev => ({ ...prev, username: event.target.value }))}
                  className={userErrors.username ? "border-destructive" : ""}
                />
                {userErrors.username && <p className="text-sm text-destructive">{userErrors.username}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="userRole">Perfil</Label>
                <Select value={userForm.accessProfile} onValueChange={(value) => setUserForm(prev => ({ ...prev, accessProfile: value }))}>
                  <SelectTrigger id="userRole"><SelectValue /></SelectTrigger>
                  <SelectContent>{userForm.accessProfile === "restaurante" && <SelectItem value="restaurante" disabled>Módulo arquivado</SelectItem>}{Object.entries(PROFILES).filter(([key]) => key !== "restaurante").map(([key, profile]) => <SelectItem key={key} value={key} disabled={effectivePermissions({ accessProfile: key }).some(permission => !can(permission))}>{profile.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userFullName">Nome completo</Label>
              <Input
                id="userFullName"
                value={userForm.fullName}
                onChange={(event) => setUserForm(prev => ({ ...prev, fullName: event.target.value }))}
                className={userErrors.fullName ? "border-destructive" : ""}
              />
              {userErrors.fullName && <p className="text-sm text-destructive">{userErrors.fullName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="userEmail">Email</Label>
              <Input
                id="userEmail"
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm(prev => ({ ...prev, email: event.target.value }))}
                className={userErrors.email ? "border-destructive" : ""}
              />
              {userErrors.email && <p className="text-sm text-destructive">{userErrors.email}</p>}
            </div>

            <UserPermissionsEditor profile={userForm.accessProfile} overrides={userForm.permissionOverrides} onChange={permissionOverrides => setUserForm(previous => ({ ...previous, permissionOverrides }))} />

            <div className="space-y-2">
              <Label htmlFor="userPassword">{editingUser ? "Nova senha" : "Senha inicial"}</Label>
              <Input
                id="userPassword"
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm(prev => ({ ...prev, password: event.target.value }))}
                placeholder={editingUser ? "Deixe em branco para manter" : "Senha inicial"}
                className={userErrors.password ? "border-destructive" : ""}
              />
              {userErrors.password && <p className="text-sm text-destructive">{userErrors.password}</p>}
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="userActive">Usuário ativo</Label>
                <p className="text-sm text-muted-foreground">Usuários inativos nao devem acessar o sistema.</p>
              </div>
              <Switch
                id="userActive"
                checked={userForm.active}
                onCheckedChange={(checked) => setUserForm(prev => ({ ...prev, active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeUserDialog}>Cancelar</Button>
            <Button disabled={isUserSaving} onClick={handleSaveUser}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
