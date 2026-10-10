"use client"
import { isPousadaPermission } from "@/lib/pousada-scope"
import { useMemo, useState } from "react"
import { PERMISSIONS, PROFILES, APPROVAL_PERMISSIONS, effectivePermissions, type PermissionOverrides } from "@/lib/permissions"
import { useAuth } from "@/lib/auth-context"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
export function UserPermissionsEditor({ profile, overrides, onChange }: { profile: string; overrides: PermissionOverrides; onChange: (value: PermissionOverrides) => void }) {
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const effective = useMemo(() => new Set(effectivePermissions({ accessProfile: profile, permissionOverrides: overrides }).filter(isPousadaPermission)), [profile, overrides])
  return <section className="space-y-3"><p className="text-sm">{effective.size} acessos liberados. O perfil fornece os acessos iniciais; as exceções abaixo têm prioridade.</p>
    <Label htmlFor="permission-search">Buscar permissão</Label><Input id="permission-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Ex.: reserva, estoque, estorno" />
    <div className="max-h-64 overflow-auto rounded-md border divide-y">
      {PERMISSIONS.filter(item => isPousadaPermission(item.key)).filter(item => `${item.label} ${item.key}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))).map(item => <div key={item.key} className="flex items-center justify-between gap-3 p-3 text-sm">
        <div><label htmlFor={`permission-${item.key}`} className="font-medium">{item.label}</label><p className={effective.has(item.key) ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>{effective.has(item.key) ? "Permitido" : overrides[item.key] !== "deny" && APPROVAL_PERMISSIONS.includes(item.key) ? "Requer aprovação por operação" : "Bloqueado"}</p></div>
        <select id={`permission-${item.key}`} className="rounded border bg-background p-2" value={overrides[item.key] ?? "inherit"} onChange={event => { const next = { ...overrides }; if (event.target.value === "inherit") delete next[item.key]; else next[item.key] = event.target.value as "allow" | "deny"; onChange(next) }}>
          <option value="inherit">Herdar ({PROFILES[profile]?.permissions.includes(item.key) ? "permitido" : "bloqueado"})</option><option value="allow" disabled={!can(item.key)}>Permitir</option><option value="deny">Bloquear</option>
        </select>
      </div>)}
    </div></section>
}
