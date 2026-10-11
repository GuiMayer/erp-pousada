import { normalizeDocument } from "./cpf-cnpj-validator"
export function matchesPerson(person: { name: string; cpfCnpj?: string; phone?: string; phone2?: string }, query: string) {
  const text = query.trim().toLocaleLowerCase("pt-BR")
  if (!text) return true
  const digits = query.replace(/\D/g, "")
  return person.name.toLocaleLowerCase("pt-BR").includes(text)
    || !!person.cpfCnpj?.includes(normalizeDocument(query))
    || (digits.length >= 3 && /^[\d\s()+.-]+$/.test(query) && [person.phone, person.phone2].some(phone => phone?.replace(/\D/g, "").includes(digits)))
}
