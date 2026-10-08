import { NextRequest } from "next/server"
import { authorize } from "./auth"
import { HttpError } from "./http"
import { collectionMapper } from "./db/relational-data-service"
const restricted = ["users", "userSessions", "employees", "employeeConsumptions"]
// Business operations use dedicated transactional endpoints; generic mutation of
// ledgers remains limited to supervisors (e.g. supervised corrections).
const operatorWrites = ["guests", "customers", "auditLog"]
export async function authorizeCollection(request: NextRequest, key: string) {
  collectionMapper(key)
  const write = !["GET", "HEAD"].includes(request.method)
  if (write && ["reservations", "transactions", "cashCloses", "bankTransfers", "posSales", "restaurantOrders", "consumptions", "stockMovements", "productions", "employeeConsumptions"].includes(key)) throw new HttpError(403, "Utilize a operação específica")
  const actor = await authorize(request, restricted.includes(key) || (write && !operatorWrites.includes(key)))
  if (key === "userSessions" && write) throw new HttpError(403, "Sessões são gerenciadas pelo servidor")
  if (["auditLog", "userSessions"].includes(key) && write && request.method !== "POST") throw new HttpError(403, "Histórico não pode ser alterado")
  return actor
}
