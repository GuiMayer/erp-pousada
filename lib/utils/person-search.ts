import { normalizeDocument } from "./cpf-cnpj-validator";
export function matchesPerson(
  person: { name: string; cpfCnpj?: string; phone?: string; phone2?: string },
  query: string,
) {
  const normalizeName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const text = normalizeName(query.trim());
  if (!text) return true;
  const digits = query.replace(/\D/g, "");
  return (
    normalizeName(person.name).includes(text) ||
    !!person.cpfCnpj?.includes(normalizeDocument(query)) ||
    (digits.length >= 3 &&
      /^[\d\s()+.-]+$/.test(query) &&
      [person.phone, person.phone2].some((phone) =>
        phone?.replace(/\D/g, "").includes(digits),
      ))
  );
}
