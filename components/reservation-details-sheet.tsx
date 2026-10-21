"use client"
import type { ReactNode } from "react"
import type { Reservation } from "@/lib/store"
import { useApp } from "@/lib/app-context"
import { formatCurrency } from "@/lib/utils/formatters"
import { LodgingQuotePreview } from "./lodging-quote-preview"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet"

export const reservationLabels = { confirmada: "Confirmada", checkin: "Hospedado", checkout: "Encerrada", cancelada: "Cancelada", noshow: "Ausência" }
const date = (value: string) => value.split("-").reverse().join("/")

export function ReservationDetailsSheet({ reservation: detail, onClose, children }: { reservation: Reservation; onClose: () => void; children?: ReactNode }) {
  const { customers } = useApp()
  return <Sheet open onOpenChange={open => { if (!open) onClose() }}><SheetContent className="overflow-y-auto sm:max-w-lg"><SheetHeader><SheetTitle>Reserva · {detail.guestName}</SheetTitle><SheetDescription>Quarto {detail.roomNumber} · {reservationLabels[detail.status]}</SheetDescription></SheetHeader>
<div className="space-y-4 py-6 text-sm"><p>CPF: {detail.cpf}</p><p>Entrada prevista: {date(detail.checkIn)} · Saída: {date(detail.checkOut)}</p><p>Pessoas: {detail.guestCount ?? "Informe a ocupação"} · Responsável: {customers.find(c => c.id === detail.payerId)?.name ?? "Revise o pagador"}</p><p>Contratado: {formatCurrency(detail.totalValue)} · Recebido: {formatCurrency(detail.paidValue ?? 0)}</p>{detail.nightlyPrices && <details><summary className="cursor-pointer">Composição do preço contratado</summary><LodgingQuotePreview result={{ quote: { nights: detail.nightlyPrices, total: detail.nightlyPrices.reduce((s, n) => s + n.total, 0) } }} /></details>}{detail.priceExceptionReason && <p>Preço autorizado: {detail.priceExceptionReason}</p>}{["cancelada", "noshow"].includes(detail.status) && <section className="space-y-2 rounded border p-3"><p>Devolvido: {formatCurrency(detail.refundedValue ?? 0)} · Retido: {formatCurrency(detail.retainedValue ?? 0)} · Crédito: {formatCurrency(detail.cancelTreatment === "credito" ? (detail.cancellationReceivedValue ?? detail.paidValue ?? 0) - (detail.retainedValue ?? 0) : 0)}</p>{detail.cancellationReason && <p className="whitespace-pre-wrap break-words">Motivo do cancelamento: {detail.cancellationReason}</p>}{detail.cancellationFinancialReason && <p className="whitespace-pre-wrap break-words">Justificativa financeira: {detail.cancellationFinancialReason}</p>}{detail.cancelledAt && <p>Cancelado em {new Date(detail.cancelledAt).toLocaleString("pt-BR")} por {detail.cancelledBy}.</p>}</section>}{children}</div>
  </SheetContent></Sheet>
}
