import { ApiError } from "./conflicts"
export type ApprovalChallenge = { kind: string; payload: unknown; requestId: string; permission: string; resourceHash: string; summary: { label: string; value: string }[]; resolve: () => void; reject: (error: Error) => void }
async function requestApproval(challenge: Omit<ApprovalChallenge, "resolve" | "reject">) {
  await new Promise<void>((resolve, reject) => window.dispatchEvent(new CustomEvent<ApprovalChallenge>("erp:approval-required", { detail: { ...challenge, resolve, reject } })))
}
export async function submitOperation<T = unknown>(kind: string, payload: unknown, requestId: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, payload, requestId }) })
    if (response.status === 401) window.dispatchEvent(new Event("erp:session-expired"))
    const data = await response.json()
    if (response.ok) return data as T
    if (response.status === 403 && data.approvalRequired && attempt < 2) { await requestApproval({ kind, payload, requestId, permission: data.permission, resourceHash: data.resourceHash, summary: data.summary ?? [] }); continue }
    if (response.status === 403) window.dispatchEvent(new Event("erp:permissions-changed"))
    throw new ApiError(data.error || "Não foi possível concluir a operação", response.status, data.code)
  }
  throw new Error("A aprovação não pôde ser concluída")
}
