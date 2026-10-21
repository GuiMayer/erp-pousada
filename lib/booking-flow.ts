import { z } from "zod"
import { businessDay, BUSINESS_TIME_ZONE } from "./utils/business-values"

export const cancellationReason = z.string().trim().max(500).optional().transform(value => value || undefined)
export function checkinDateError(arrival: string, departure: string, completed = false, today = businessDay()) {
  if (!z.string().date().safeParse(arrival).success || !z.string().date().safeParse(departure).success) return "Informe datas válidas"
  if (arrival > today) return "Check-in futuro não é permitido. Crie uma reserva para essa data."
  if (departure <= arrival) return "A saída deve ser posterior à chegada"
  if (completed && departure > today) return "Uma hospedagem encerrada não pode ter saída futura"
  if (!completed && departure <= today) return "Revise a saída prevista ou registre a hospedagem já encerrada"
}
export function noShowEligible(arrival: string, time: string, now = new Date()) {
  const today = businessDay(now)
  if (arrival !== today) return arrival < today
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now)
  return hour >= time
}

export type CancellationDecision = "refund" | "retain" | "credit"
export function cancellationAmounts(received: number, decision: CancellationDecision, refund?: number) {
  const available = Math.round(received * 100)
  const returned = decision === "refund" ? Math.round((refund ?? received) * 100) : 0
  if (available < 0 || returned < 0 || returned > available || !Number.isFinite(returned)) throw new Error("Devolução deve estar entre zero e o valor recebido")
  return { refund: returned / 100, retained: decision === "credit" ? 0 : (available - returned) / 100, credit: decision === "credit" ? available / 100 : 0 }
}
