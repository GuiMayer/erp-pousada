import { HttpError } from "./http"
import { logEvent } from "./logging"

export function requireVersion(expected: unknown, actual: unknown) {
  if (!Number.isSafeInteger(expected) || Number(expected) < 0) throw new HttpError(428, "Atualize a página e reabra o formulário antes de salvar.", { code: "VERSION_REQUIRED" })
  if (expected !== actual) {
    logEvent("info", "concurrency.stale")
    throw new HttpError(409, "Este registro foi alterado em outro dispositivo. Sua edição foi preservada.", { code: "STALE_VERSION" })
  }
}
export const removed = () => new HttpError(404, "Este registro foi removido. Sua edição foi preservada.", { code: "RESOURCE_REMOVED" })
export const retryDelay = (attempt: number) => new Promise(resolve => setTimeout(resolve, 40 * 2 ** attempt + Math.random() * 80))
