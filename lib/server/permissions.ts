import type { Actor } from "./auth"
import { effectivePermissions, operationPermissions, APPROVAL_PERMISSIONS } from "@/lib/permissions"
import { HttpError } from "./http"
export const DELEGATABLE = APPROVAL_PERMISSIONS
export function can(actor: Actor, permission: string) {
  return (actor.permissions ?? effectivePermissions(actor)).includes(permission)
}
export function demand(actor: Actor, permission: string) {
  if (actor.permissionOverrides?.[permission] !== "deny" && (can(actor, permission) || actor.grantedPermissions?.includes(permission))) return
  const approvalRequired = DELEGATABLE.includes(permission) && actor.permissionOverrides?.[permission] !== "deny"
  throw new HttpError(403, approvalRequired ? "Esta operação exige aprovação" : "Você não tem permissão para esta ação", { approvalRequired, permission })
}
export function demandOperation(actor: Actor, kind: string) {
  const permission = operationPermissions[kind]
  if (permission) demand(actor, permission)
  else if (!["admin-create", "admin-update"].includes(kind)) throw new HttpError(400, "Operação inválida")
}
