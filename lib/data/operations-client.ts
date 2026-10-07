export async function submitOperation<T = unknown>(kind: string, payload: unknown, requestId: string): Promise<T> {
  const response = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, payload, requestId }) })
  if (response.status === 401) window.dispatchEvent(new Event("erp:session-expired"))
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação")
  return data as T
}
