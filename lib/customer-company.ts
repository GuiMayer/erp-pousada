import type { Customer } from "./store"
import { validateCPF, validateCNPJ } from "./utils/cpf-cnpj-validator"

type Contact = Pick<Customer, "id" | "cpfCnpj" | "active" | "roles" | "companyId">
export const isCompanyPayer = (person: Contact) => validateCNPJ(person.cpfCnpj) && (person.roles ?? ["payer"]).includes("payer")

// Suggest only for a new stay. The saved reservation remains the source of its payer.
export function suggestPayerId(person: Contact | undefined, people: Contact[]) {
  if (!person?.active) return ""
  const company = people.find(p => p.id === person.companyId)
  if (company?.active && isCompanyPayer(company)) return company.id
  return (person.roles ?? ["payer"]).includes("payer") ? person.id : ""
}

export function companyLinkError(person: Contact, people: Contact[], previous?: Contact | null): string | undefined {
  if (person.companyId) {
    if (!validateCPF(person.cpfCnpj)) return "Somente pessoa com CPF válido pode ser vinculada a uma empresa"
    if (person.companyId === person.id) return "Pessoa não pode ser vinculada a si mesma"
    const company = people.find(p => p.id === person.companyId)
    if (!company || !isCompanyPayer(company)) return "Selecione uma empresa com CNPJ válido e papel de pagador"
    if (!company.active && person.companyId !== previous?.companyId) return "Reative a empresa antes de criar o vínculo"
  }
  if (person.id && people.some(p => p.companyId === person.id) && !isCompanyPayer(person)) return "Empresa com pessoas vinculadas deve manter CNPJ e papel de pagador"
}
