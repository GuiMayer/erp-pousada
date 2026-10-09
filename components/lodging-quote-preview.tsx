"use client"
import { useApp } from "@/lib/app-context"
import { quoteLodging, type LodgingQuote } from "@/lib/lodging-pricing"
import { formatCurrency } from "@/lib/utils/formatters"
import type { Room } from "@/lib/store"

export function previewLodging(room: Room | undefined, tariffs: ReturnType<typeof useApp>["lodgingTariffs"], guestCount: number, checkIn: string, checkOut: string): { quote?: LodgingQuote; error?: string } {
  if (!room || !checkIn || !checkOut) return {}
  try { return { quote: quoteLodging(room, tariffs, { roomId: room.id, guestCount, checkIn, checkOut }) } }
  catch (error) { return { error: error instanceof Error ? error.message : "Revise os dados" } }
}
export function LodgingQuotePreview({ result }: { result: ReturnType<typeof previewLodging> }) {
  if (result.error) return <p role="status" className="text-sm text-destructive">{result.error}</p>
  if (!result.quote) return <p className="text-sm text-muted-foreground">Informe entrada e saída para calcular as noites.</p>
  return <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
    <p className="font-medium">{result.quote.nights.length} noite(s) · Total {formatCurrency(result.quote.total)}</p>
    <details className="mt-2"><summary className="cursor-pointer py-1">Ver cálculo por noite</summary><ul className="space-y-2 py-2">
      {result.quote.nights.map(n => <li key={n.date}>{n.date.split("-").reverse().join("/")} · {n.guests} × {formatCurrency(n.pricePerPerson)} = {formatCurrency(n.total)}<span className="block text-xs text-muted-foreground">{n.tariffName}</span></li>)}
    </ul></details>
  </div>
}
