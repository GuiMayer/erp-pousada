import { NextRequest } from "next/server"
import { authorize } from "./auth"
import { demand } from "./permissions"
import { HttpError } from "./http"
import { collectionMapper } from "./db/relational-data-service"
import { operationalCollections } from "@/lib/permissions"
export async function authorizeCollection(request: NextRequest, key: string) {
  collectionMapper(key)
  const actor = await authorize(request)
  const write = !["GET", "HEAD"].includes(request.method)
  if (write && [...operationalCollections, "auditLog", "userSessions"].includes(key)) throw new HttpError(403, "Utilize a operação específica; histórico é registrado pelo servidor")
  if (key === "users" && write) demand(actor, "users.manage")
  const action = !write ? "read" : request.method === "POST" ? "create" : request.method === "DELETE" ? "delete" : "edit"
  if (!(key === "bankAccounts" && !write && actor.permissions?.includes("bankAccounts.use"))) demand(actor, `${key}.${action}`)
  return actor
}
