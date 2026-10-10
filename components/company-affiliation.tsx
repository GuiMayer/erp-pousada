"use client"
import type { Customer } from "@/lib/store"
import { isCompanyPayer } from "@/lib/customer-company"
import { formatCpfCnpj, isCPF } from "@/lib/utils/cpf-cnpj-validator"
import { Label } from "./ui/label"

export function CompanyAffiliationField({ people, document, value, onChange, id = "customer-company" }: { people: Customer[]; document: string; value?: string | null; onChange: (id: string | null) => void; id?: string }) {
  const companies = people.filter(c => c.active && isCompanyPayer(c) || c.id === value).sort((a, b) => a.name.localeCompare(b.name))
  return <div className="space-y-2">
    <Label htmlFor={id}>Empresa vinculada (opcional)</Label>
    <select id={id} className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={value ?? ""} disabled={!isCPF(document) && !value} onChange={e => onChange(e.target.value || null)}>
      <option value="">Sem vínculo com empresa</option>
      {companies.map(c => <option key={c.id} value={c.id} disabled={!c.active || !isCompanyPayer(c)}>{c.name}{!c.active ? " · Inativa" : ""}</option>)}
    </select>
    <p className="text-xs text-muted-foreground">{isCPF(document) ? "Empresa sugerida como pagadora nas novas hospedagens. O pagador pode ser alterado na reserva." : "Informe o CPF da pessoa para vincular uma empresa."}</p>
  </div>
}

export function CompanyMembers({ companyId, people }: { companyId: string; people: Customer[] }) {
  const members = people.filter(c => c.companyId === companyId).sort((a, b) => a.name.localeCompare(b.name))
  return <section className="space-y-3" aria-label="Funcionários vinculados">
    <h3 className="font-semibold">Funcionários vinculados ({members.length})</h3>
    {members.length ? <ul className="space-y-2">{members.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"><div><p className="font-medium">{c.name}</p><p className="text-muted-foreground">{formatCpfCnpj(c.cpfCnpj)}</p></div><span>{c.active ? "Ativo" : "Inativo"}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhuma pessoa vinculada a esta empresa.</p>}
    <p className="text-xs text-muted-foreground">Para vincular, trocar ou remover a empresa, edite o cadastro da pessoa. Reservas anteriores mantêm seu pagador.</p>
  </section>
}
