"use client"
import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { FinancialCadastrosManagement } from "./financial-cadastros-management"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

export function FinancialDefinitions() {
  const { categories, addCategory } = useApp()
  const { can } = useAuth()
  const [name, setName] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState("")
  return <div className="space-y-4">
    <FinancialCadastrosManagement sections={["bankAccount", "costCenter"]} />
    {can("categories.read") && <Card><CardHeader><CardTitle>Categorias financeiras</CardTitle></CardHeader><CardContent className="space-y-3">
      <ul className="flex flex-wrap gap-2">{categories.map(category => <li key={category.id} className="rounded border px-3 py-2 text-sm">{category.label}</li>)}</ul>
      {can("categories.create") && <form className="flex flex-wrap items-end gap-2" onSubmit={async event => {
        event.preventDefault(); if (pending || !name.trim() || !can("categories.create")) return
        setPending(true); setError("")
        try { await addCategory(name.trim()); setName("") } catch (failure) { setError(failure instanceof Error ? failure.message : "Categoria não salva") } finally { setPending(false) }
      }}><Label className="flex-col items-stretch">Nova categoria<Input value={name} onChange={event => setName(event.target.value)} disabled={pending} /></Label><Button disabled={pending || !name.trim()}>Adicionar categoria</Button></form>}
      {error && <p role="alert">{error}</p>}
    </CardContent></Card>}
  </div>
}
