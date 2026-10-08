export function nativePermission(): NotificationPermission | "unsupported" {
  try { return typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "unsupported" } catch { return "unsupported" }
}
export async function requestNativePermission() {
  try { return nativePermission() === "default" ? await window.Notification.requestPermission() : nativePermission() } catch { return nativePermission() }
}
function claimAndPresent(userId: string, id: string) {
  // A synchronous claim prevents duplicate delivery during polling on one origin.
  try {
    if (nativePermission() !== "granted") return
    const key = `erp:native:${userId}`
    const seen: string[] = JSON.parse(localStorage.getItem(key) || "[]")
    if (seen.includes(id)) return
    localStorage.setItem(key, JSON.stringify([...seen, id].slice(-200)))
    new window.Notification("ERP Pousada", { body: "Há uma nova atualização na sua central de notificações.", icon: "/icon.svg", tag: id })
  } catch { /* Native delivery never changes a confirmed business result. */ }
}

export function presentNative(userId: string, id: string) {
  try {
    if (navigator.locks) { void navigator.locks.request(`erp-native:${userId}`, () => claimAndPresent(userId, id)).catch(() => {}); return }
    claimAndPresent(userId, id)
  } catch { /* Device/browser restrictions are optional delivery failures. */ }
}
