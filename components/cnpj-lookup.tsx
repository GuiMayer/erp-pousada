"use client"
import { useState } from "react"
import { Button } from "./ui/button"
import { normalizeDocument, validateCNPJ } from "@/lib/utils/cpf-cnpj-validator"
import type { CompanySuggestion } from "@/lib/server/company-lookup"

export function CnpjLookup({ document, onApply }: { document: string; onApply: (company: CompanySuggestion) => void }) {
  const [suggestion, setSuggestion] = useState<CompanySuggestion | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const cnpj = normalizeDocument(document)
  async function lookup() {
    if (pending) return
    setPending(true); setSuggestion(null); setError("")
    try {
      const response = await fetch(`/api/companies?cnpj=${encodeURIComponent(cnpj)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Consulta indisponível. Preencha manualmente")
      setSuggestion(data)
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Consulta indisponível. Preencha manualmente") }
    finally { setPending(false) }
  }
  if (!validateCNPJ(cnpj)) return null
  return <div className="space-y-2">
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={lookup}>{pending ? "Consultando…" : "Consultar CNPJ"}</Button>
    {error && <p role="status" className="text-sm text-muted-foreground">{error}</p>}
    {suggestion?.cpfCnpj === cnpj && <div className="space-y-2 rounded-lg border p-3 text-sm">
      <p className="font-medium">{suggestion.name}</p><p>{suggestion.address} — {suggestion.city}/{suggestion.state}</p>
      <p>{suggestion.phone} {suggestion.email}</p>
      <p className="text-muted-foreground">Confira os dados retornados pela BrasilAPI antes de usar. O cadastro ainda precisa ser salvo.</p>
      <Button type="button" size="sm" onClick={() => { onApply(suggestion); setSuggestion(null) }}>Usar estes dados</Button>
    </div>}
  </div>
}
