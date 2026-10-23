import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LoginScreen } from "@/components/login-screen"
const login = vi.fn(async () => true)
const initialize = vi.fn<(...args: unknown[]) => Promise<boolean>>().mockResolvedValue(true)
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ login }) }))
vi.mock("@/lib/app-context", () => ({ useApp: () => ({ systemSettings: { pousadaName: "Pousada de teste" } }) }))
vi.mock("@/lib/demo-data", () => ({ initializeBrowserDemo: (...args: unknown[]) => initialize(...args) }))
vi.mock("@/lib/data/repositories", () => ({ createDataStore: () => ({ exportAll: vi.fn(), importAll: vi.fn() }) }))
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
describe("Acessos da demonstração", () => {
  it("shows credentials in a dialog, fills them without signing in automatically and allows restoring examples", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "demo-localStorage")
    render(<LoginScreen />)
    expect(screen.getByRole("dialog", { name: "Explore a demonstração" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Restaurar exemplos e descartar alterações" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Exemplos restaurados"))
    expect(initialize).toHaveBeenCalledWith(expect.anything(), true)
    fireEvent.click(screen.getByRole("button", { name: "Preencher acesso de supervisor" }))
    expect(screen.getByLabelText("Usuário")).toHaveValue("supervisor")
    expect(screen.getByLabelText("Senha")).toHaveValue("adm123")
    expect(login).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }))
    await waitFor(() => expect(login).toHaveBeenCalledWith("supervisor", "adm123"))
  })
  it("never exposes demo credentials or reset in database mode", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database")
    render(<LoginScreen />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", {name: "Acessos da demonstração"})).not.toBeInTheDocument()
    expect(initialize).not.toHaveBeenCalled()
  })
})
