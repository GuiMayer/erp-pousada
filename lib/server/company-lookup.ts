import { normalizeDocument, validateCNPJ } from "@/lib/utils/cpf-cnpj-validator"
import { HttpError } from "./http"

export type CompanySuggestion = { cpfCnpj: string; name: string; email: string; phone: string; address: string; city: string; state: string; zipCode: string }
export async function lookupCompany(document: string): Promise<CompanySuggestion> {
  const cnpj = normalizeDocument(document)
  if (!validateCNPJ(cnpj)) throw new HttpError(400, "CNPJ inválido")
  let response: Response
  try { response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error" }) }
  catch { throw new HttpError(503, "Consulta indisponível. Preencha os dados manualmente") }
  if (!response.ok) throw new HttpError(response.status === 404 ? 404 : 503, "CNPJ não encontrado ou consulta indisponível. O cadastro manual continua disponível")
  let data: Record<string, unknown>
  try { data = await response.json() } catch { throw new HttpError(503, "Resposta de consulta inválida. Preencha manualmente") }
  const field = (key: string) => typeof data[key] === "string" ? (data[key] as string).trim().slice(0, 200) : ""
  if (normalizeDocument(field("cnpj")) !== cnpj || !field("razao_social")) throw new HttpError(503, "Não foi possível conferir o CNPJ retornado. Preencha manualmente")
  return { cpfCnpj: cnpj, name: field("razao_social"), email: field("email"), phone: field("ddd_telefone_1"), address: [field("logradouro"), field("numero"), field("complemento"), field("bairro")].filter(Boolean).join(", "), city: field("municipio"), state: field("uf"), zipCode: field("cep") }
}
