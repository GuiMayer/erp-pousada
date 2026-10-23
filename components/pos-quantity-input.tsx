"use client"
import { useEffect, useState } from "react"
import { Input } from "./ui/input"

export function POSQuantityInput({ name, quantity, onCommit }: { name: string; quantity: number; onCommit: (value: number) => boolean }) {
  const [draft, setDraft] = useState(String(quantity))
  useEffect(() => { setDraft(String(quantity)) }, [quantity])
  function commit() {
    const next = Number(draft)
    if (!draft.trim() || !Number.isSafeInteger(next) || next < 1 || !onCommit(next)) setDraft(String(quantity))
  }
  return <Input type="number" inputMode="numeric" min={1} step={1} aria-label={`Quantidade de ${name}`} value={draft} onFocus={event => event.currentTarget.select()} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur() } }} className="pos-quantity-input w-14 px-1 text-center tabular-nums" />
}
