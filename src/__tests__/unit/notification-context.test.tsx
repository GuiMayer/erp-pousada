import { StrictMode } from "react"
import { act, renderHook, waitFor, cleanup } from "@testing-library/react"
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest"
import { NotificationProvider, useNotifications } from "@/lib/notification-context"
import { presentNative, requestNativePermission } from "@/lib/native-notifications"
const auth = vi.hoisted(() => ({ user: { id: "a", accessVersion: 0, permissions: ["reservations.read"] } }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }))
const wrapper = ({ children }: { children: React.ReactNode }) => <StrictMode><NotificationProvider>{children}</NotificationProvider></StrictMode>
beforeEach(() => { localStorage.clear(); auth.user = { id: "a", accessVersion: 0, permissions: ["reservations.read"] }; vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "demo-localStorage") })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe("Isolamento e tolerância a falhas", () => {
  it("oculta alertas legados do restaurante e os exclui do contador", async () => {
    localStorage.setItem("erp:demo:notifications:a", JSON.stringify(["restaurant", "production", "pos"].map(type => ({ id: type, type, title: type, message: "Teste", timestamp: new Date(), read: false, priority: "medium" }))))
    const { result } = renderHook(useNotifications, { wrapper })
    await waitFor(() => expect(result.current.unreadCount).toBe(1))
    expect(result.current.notifications.map(notification => notification.type)).toEqual(["pos"])
  })
  it("preserva histórico durante montagem StrictMode", async () => {
    localStorage.setItem("erp:demo:notifications:a", JSON.stringify([{ id: "existing", type: "reservation", title: "Teste", message: "Teste", timestamp: new Date(), read: false, priority: "medium" }]))
    const { result } = renderHook(useNotifications, { wrapper }); await waitFor(() => expect(result.current.notifications).toHaveLength(1))
    expect(JSON.parse(localStorage.getItem("erp:demo:notifications:a")!)).toHaveLength(1)
  })
  it("não mistura histórico ou preferências entre identidades", async () => {
    const first = renderHook(useNotifications, { wrapper })
    act(() => { first.result.current.sendNotification("reservation", "Teste", "Teste"); first.result.current.updatePreferences({ payments: false }) })
    await waitFor(() => expect(first.result.current.notifications).toHaveLength(1)); first.unmount(); auth.user.id = "b"
    const second = renderHook(useNotifications, { wrapper }); await waitFor(() => expect(second.result.current.preferences.payments).toBe(true)); expect(second.result.current.notifications).toHaveLength(0)
  })
  it("falha nativa não se propaga ao negócio nem impede histórico", async () => {
    const native = vi.fn(function () { throw new Error("unsupported") }); Object.assign(native, { permission: "granted" }); vi.stubGlobal("Notification", native)
    const { result } = renderHook(useNotifications, { wrapper })
    await act(async () => { result.current.updatePreferences({ browserNotifications: true }) })
    act(() => expect(() => result.current.sendNotification("reservation", "Teste", "Teste")).not.toThrow())
    expect(result.current.notifications).toHaveLength(1)
  })
  it("captura rejeição da permissão nativa e deduplica entrega", async () => {
    const native = vi.fn(); Object.assign(native, { permission: "default", requestPermission: vi.fn().mockRejectedValue(new Error("denied")) }); vi.stubGlobal("Notification", native)
    await expect(requestNativePermission()).resolves.toBe("default")
    Object.assign(native, { permission: "granted" }); presentNative("a", "event"); presentNative("a", "event"); expect(native).toHaveBeenCalledTimes(1)
  })
  it("selecionar o filtro atual não apaga mensagens carregadas", async () => {
    const { result } = renderHook(useNotifications, { wrapper })
    act(() => result.current.sendNotification("reservation", "Teste", "Teste"))
    act(() => result.current.showArchived(false))
    expect(result.current.notifications).toHaveLength(1)
  })
  it("ignora respostas da identidade anterior", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    let finish: (value: unknown) => void = () => {}
    const pending = new Promise(resolve => { finish = resolve })
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => pending))
    const first = renderHook(useNotifications, { wrapper }); first.unmount(); auth.user.id = "b"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ notifications: [], preferences: {}, unreadCount: 0, nextCursor: null }) }))
    const second = renderHook(useNotifications, { wrapper })
    await act(async () => finish({ ok: true, json: async () => ({ notifications: [{ id: "old", timestamp: new Date() }], unreadCount: 1, preferences: {}, nextCursor: null }) }))
    await waitFor(() => expect(second.result.current.loading).toBe(false)); expect(second.result.current.notifications).toHaveLength(0)
  })
})
