"use client";
import { useEffect, useState, useRef } from "react";
import { useActiveTab } from "@/contexts/active-tab-context";
import {
  PROFILES,
  effectivePermissions,
  type PermissionOverrides,
} from "@/lib/permissions";
import { UserPermissionsEditor } from "@/components/user-permissions-editor";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, UserCog } from "lucide-react";
import { toast } from "sonner";
import type { User, UserRole } from "@/lib/store";
type UserFormData = {
  username: string;
  password: string;
  role: UserRole;
  accessProfile: string;
  permissionOverrides: PermissionOverrides;
  fullName: string;
  email: string;
  active: boolean;
};

const emptyUserForm: UserFormData = {
  username: "",
  password: "",
  role: "operador",
  accessProfile: "recepcao",
  permissionOverrides: {},
  fullName: "",
  email: "",
  active: true,
};

export function UsersSection() {
  const { users, addUser, updateUser, addAuditEntry } = useApp(),
    { username, can } = useAuth();
  const { registerNavigationGuard } = useActiveTab();
  const pendingRef = useRef(false);
  const [isUserSaving, setUserSaving] = useState(false),
    [isUserDialogOpen, setIsUserDialogOpen] = useState(false),
    [editingUser, setEditingUser] = useState<User | null>(null),
    [userForm, setUserForm] = useState<UserFormData>(emptyUserForm),
    [userErrors, setUserErrors] = useState<Record<string, string>>({});
  useEffect(
    () =>
      registerNavigationGuard(() => {
        if (pendingRef.current) return false;
        if (isUserDialogOpen) {
          toast.info(
            "Conclua ou cancele o formulário de usuário antes de sair.",
          );
          return false;
        }
        return true;
      }),
    [isUserDialogOpen, registerNavigationGuard],
  );

  const openUserDialog = (userToEdit?: User) => {
    setEditingUser(userToEdit ?? null);
    setUserForm(
      userToEdit
        ? {
            username: userToEdit.username,
            password: "",
            role: userToEdit.role,
            accessProfile:
              userToEdit.accessProfile ||
              (userToEdit.role === "supervisor"
                ? "administrador"
                : "operador_legado"),
            permissionOverrides: userToEdit.permissionOverrides ?? {},
            fullName: userToEdit.fullName,
            email: userToEdit.email ?? "",
            active: userToEdit.active,
          }
        : emptyUserForm,
    );
    setUserErrors({});
    setIsUserDialogOpen(true);
  };

  const closeUserDialog = () => {
    setIsUserDialogOpen(false);
    setEditingUser(null);
    setUserForm(emptyUserForm);
    setUserErrors({});
  };

  const validateUserForm = () => {
    const nextErrors: Record<string, string> = {};
    const trimmedUsername = userForm.username.trim();
    const trimmedFullName = userForm.fullName.trim();

    if (!trimmedUsername) nextErrors.username = "Usuário e obrigatorio";
    if (!trimmedFullName) nextErrors.fullName = "Nome completo e obrigatorio";
    if (!editingUser && !userForm.password.trim())
      nextErrors.password = "Senha inicial e obrigatoria";
    if (
      userForm.password &&
      (userForm.password.length < 12 ||
        new TextEncoder().encode(userForm.password).length > 72)
    )
      nextErrors.password = "Use pelo menos 12 caracteres e no máximo 72 bytes";
    if (userForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email))
      nextErrors.email = "Email invalido";

    const duplicate = users.find(
      (userItem) =>
        userItem.username.toLowerCase() === trimmedUsername.toLowerCase() &&
        userItem.id !== editingUser?.id,
    );
    if (duplicate) nextErrors.username = "Usuário ja cadastrado";

    setUserErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSaveUser = async () => {
    if (
      pendingRef.current ||
      !can(editingUser ? "users.edit" : "users.create") ||
      !validateUserForm()
    )
      return;
    pendingRef.current = true;
    setUserSaving(true);
    try {
      const auditUser = username || "sistema";
      const userData = {
        username: userForm.username.trim(),
        role: (["administrador", "supervisor"].includes(userForm.accessProfile)
          ? "supervisor"
          : "operador") as UserRole,
        accessProfile: userForm.accessProfile,
        permissionOverrides: userForm.permissionOverrides,
        ...(editingUser ? { recordVersion: editingUser.recordVersion } : {}),
        fullName: userForm.fullName.trim(),
        email: userForm.email.trim() || undefined,
        active: userForm.active,
      };

      if (editingUser) {
        await updateUser(
          editingUser.id,
          userForm.password.trim()
            ? { ...userData, password: userForm.password }
            : userData,
        );
        await addAuditEntry({ entityType: "users", operation: "update",
          user: auditUser,
          action: userForm.active ? "Usuário editado" : "Usuário desativado",
          reference: userData.username,
        });
      } else {
        await addUser({
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...userData,
          password: userForm.password,
          createdAt: new Date().toISOString(),
          createdBy: auditUser,
        });
        await addAuditEntry({ entityType: "users", operation: "create",
          user: auditUser,
          action: "Usuário criado",
          reference: userData.username,
        });
      }

      closeUserDialog();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o usuário",
      );
    } finally {
      pendingRef.current = false;
      setUserSaving(false);
    }
  };

  const handleDeactivateUser = async (targetUser: User) => {
    if (pendingRef.current || !can("users.edit") || !targetUser.active) return;
    if (!confirm(`Desativar o usuário "${targetUser.username}"?`)) return;

    const auditUser = username || "sistema";
    pendingRef.current = true;
    setUserSaving(true);
    try {
      await updateUser(targetUser.id, {
        active: false,
        recordVersion: targetUser.recordVersion,
      });
      await addAuditEntry({ entityType: "users", operation: "update",
        user: auditUser,
        action: "Usuário desativado",
        reference: targetUser.username,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível desativar o usuário",
      );
    } finally {
      pendingRef.current = false;
      setUserSaving(false);
    }
  };

  if (!can("settings.access") || !can("users.manage") || !can("users.read"))
    return null;
  return (
    <div className="space-y-5">
      {can("users.manage") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="size-4" />
              Usuários
            </CardTitle>
            <CardDescription>
              Defina perfis por setor e exceções individuais. Alterações são
              registradas automaticamente na auditoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-2"
                disabled={isUserSaving || !can("users.create")}
                onClick={() => openUserDialog()}
              >
                <Plus className="size-4" />
                Novo Usuário
              </Button>
            </div>

            <div className="rounded-md border divide-y">
              {users.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Nenhum usuário cadastrado.
                </div>
              ) : (
                users.map((userItem) => (
                  <div
                    key={userItem.id}
                    className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{userItem.fullName}</span>
                        <Badge
                          variant={userItem.active ? "default" : "secondary"}
                        >
                          {userItem.active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Badge variant="outline">
                          {PROFILES[
                            userItem.accessProfile ||
                              (userItem.role === "supervisor"
                                ? "administrador"
                                : "operador_legado")
                          ]?.label === "Restaurante"
                            ? "Módulo arquivado"
                            : PROFILES[
                                userItem.accessProfile ||
                                  (userItem.role === "supervisor"
                                    ? "administrador"
                                    : "operador_legado")
                              ]?.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {userItem.username}
                        {userItem.email ? ` - ${userItem.email}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar ${userItem.username}`}
                        disabled={isUserSaving || !can("users.edit")}
                        onClick={() => openUserDialog(userItem)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={
                          isUserSaving || !userItem.active || !can("users.edit")
                        }
                        onClick={() => handleDeactivateUser(userItem)}
                      >
                        Desativar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog
        open={isUserDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isUserSaving) closeUserDialog();
        }}
      >
        <DialogContent
          mobileTask
          protectDraft
          busy={isUserSaving}
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
            <DialogDescription>
              Defina os dados de acesso e o perfil operacional.
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={isUserSaving} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="userUsername">Usuário</Label>
                <Input
                  id="userUsername"
                  value={userForm.username}
                  onChange={(event) =>
                    setUserForm((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                  className={userErrors.username ? "border-destructive" : ""}
                />
                {userErrors.username && (
                  <p className="text-sm text-destructive">
                    {userErrors.username}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="userRole">Perfil</Label>
                <Select
                  value={userForm.accessProfile}
                  onValueChange={(value) =>
                    setUserForm((prev) => ({ ...prev, accessProfile: value }))
                  }
                >
                  <SelectTrigger id="userRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {userForm.accessProfile === "restaurante" && (
                      <SelectItem value="restaurante" disabled>
                        Módulo arquivado
                      </SelectItem>
                    )}
                    {Object.entries(PROFILES)
                      .filter(([key]) => key !== "restaurante")
                      .map(([key, profile]) => (
                        <SelectItem
                          key={key}
                          value={key}
                          disabled={effectivePermissions({
                            accessProfile: key,
                          }).some((permission) => !can(permission))}
                        >
                          {profile.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userFullName">Nome completo</Label>
              <Input
                id="userFullName"
                value={userForm.fullName}
                onChange={(event) =>
                  setUserForm((prev) => ({
                    ...prev,
                    fullName: event.target.value,
                  }))
                }
                className={userErrors.fullName ? "border-destructive" : ""}
              />
              {userErrors.fullName && (
                <p className="text-sm text-destructive">
                  {userErrors.fullName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="userEmail">Email</Label>
              <Input
                id="userEmail"
                type="email"
                value={userForm.email}
                onChange={(event) =>
                  setUserForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                className={userErrors.email ? "border-destructive" : ""}
              />
              {userErrors.email && (
                <p className="text-sm text-destructive">{userErrors.email}</p>
              )}
            </div>

            <UserPermissionsEditor
              profile={userForm.accessProfile}
              overrides={userForm.permissionOverrides}
              onChange={(permissionOverrides) =>
                setUserForm((previous) => ({
                  ...previous,
                  permissionOverrides,
                }))
              }
            />

            <div className="space-y-2">
              <Label htmlFor="userPassword">
                {editingUser ? "Nova senha" : "Senha inicial"}
              </Label>
              <Input
                id="userPassword"
                type="password"
                value={userForm.password}
                onChange={(event) =>
                  setUserForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                placeholder={
                  editingUser ? "Deixe em branco para manter" : "Senha inicial"
                }
                className={userErrors.password ? "border-destructive" : ""}
              />
              {userErrors.password && (
                <p className="text-sm text-destructive">
                  {userErrors.password}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="userActive">Usuário ativo</Label>
                <p className="text-sm text-muted-foreground">
                  Usuários inativos nao devem acessar o sistema.
                </p>
              </div>
              <Switch
                id="userActive"
                checked={userForm.active}
                onCheckedChange={(checked) =>
                  setUserForm((prev) => ({ ...prev, active: checked }))
                }
              />
            </div>
          </fieldset>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={isUserSaving}
              onClick={closeUserDialog}
            >
              Cancelar
            </Button>
            <Button disabled={isUserSaving} onClick={handleSaveUser}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
