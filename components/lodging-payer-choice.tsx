"use client"

import { useId } from "react"
import type { Customer } from "@/lib/store"
import { isCompanyPayer } from "@/lib/customer-company"

export function LodgingPayerChoice({ person, people, payerId, onChange }: {
  person?: Customer
  people: Customer[]
  payerId: string
  onChange: (id: string) => void
}) {
  const id = useId()
  const company = people.find(item => item.id === person?.companyId)
  const companyAvailable = !!company?.active && isCompanyPayer(company)
  return <section className="space-y-2 rounded-lg border p-3" aria-label="Responsável pela hospedagem">
    <p className="text-sm font-medium">Quem paga a hospedagem?</p>
    {!person ? <p className="text-sm text-muted-foreground">Selecione o hóspede para definir a cobrança.</p> : <>
      {person.companyId ? <>
        <p className="text-sm">Empresa vinculada: <strong>{company?.name ?? "Cadastro indisponível"}</strong></p>
        <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input id={id} type="checkbox" className="size-4 shrink-0 accent-primary" checked={payerId === person.id} onChange={event => onChange(event.target.checked ? person.id : person.companyId!)} disabled={!companyAvailable} />
          Pagar por conta própria, fora da empresa
        </label>
        {!companyAvailable && <p role="status" className="text-xs text-muted-foreground">A empresa está inativa ou indisponível para cobrança. Esta hospedagem será particular. Revise o vínculo no cadastro da pessoa, se necessário.</p>}
      </> : <p className="text-sm text-muted-foreground">Sem vínculo com empresa. Pagamento pelo próprio hóspede.</p>}
      <p className="text-sm">Responsável: <strong>{payerId === person.id || !person.companyId ? person.name : company?.name ?? "Empresa vinculada"}</strong></p>
      {person.companyId && <p className="text-xs text-muted-foreground">A escolha vale somente para esta hospedagem. O vínculo da pessoa com a empresa é mantido.</p>}
    </>}
  </section>
}
