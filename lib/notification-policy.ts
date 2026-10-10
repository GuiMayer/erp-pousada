import { isPousadaNotification } from "@/lib/pousada-scope"
import { z } from "zod"
import { DEFAULT_NOTIFICATION_PREFERENCES } from "./types/notifications"
export const preferenceSchema = z.object(Object.fromEntries(Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).map(key => [key, z.boolean()]))).strict()
export const ruleSchema = z.object({
  stockCriticalLevel: z.number().min(0).max(1000).default(100), stockLowLevel: z.number().min(0).max(1000).default(150),
  cashDifferenceWarning: z.number().nonnegative().max(1000000).default(50), cashDifferenceCritical: z.number().nonnegative().max(1000000).default(100),
  openOrderWarningHours: z.number().positive().max(168).default(3), openOrderCriticalHours: z.number().positive().max(168).default(4),
  yieldWarningPercentage: z.number().min(0).max(100).default(90), yieldCriticalPercentage: z.number().min(0).max(100).default(80),
}).strict().refine(r => r.stockLowLevel >= r.stockCriticalLevel && r.cashDifferenceCritical >= r.cashDifferenceWarning && r.openOrderCriticalHours >= r.openOrderWarningHours && r.yieldCriticalPercentage <= r.yieldWarningPercentage, "Limites de alerta inconsistentes")
export function categoryEnabled(type: string, prefs: typeof DEFAULT_NOTIFICATION_PREFERENCES) {
  if (!prefs.enabled || !isPousadaNotification(type)) return false
  if (["check-in", "check-out"].includes(type)) return prefs.checkInOut
  if (type === "payment") return prefs.payments
  if (type === "reservation") return prefs.reservations
  if (type === "cleaning") return prefs.cleaning
  if (type === "pos") return prefs.posRestaurant
  if (type === "stock") return prefs.stock
  if (type === "cash") return prefs.cash
  return true
}
