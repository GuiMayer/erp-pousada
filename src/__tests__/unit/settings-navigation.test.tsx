import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveTabProvider, useActiveTab } from "@/contexts/active-tab-context";
import { SettingsShell } from "@/components/settings/settings-shell";
const auth = vi.hoisted(() => ({
  allowed: ["settings.access", "settings.personal.edit", "rooms.read"],
  phone: false,
  can: (permission: string): boolean => auth.allowed.includes(permission),
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: auth.can }) }));
vi.mock("@/hooks/use-phone-layout", () => ({
  usePhoneLayout: () => auth.phone,
}));
vi.mock("next/dynamic", async () => {
  const { lazy, Suspense } = await import("react");
  return {
    default: (loader: () => Promise<React.ComponentType>) => {
      const Component = lazy(async () => ({ default: await loader() }));
      return function LazySection() {
        return (
          <Suspense fallback={<p>Carregando…</p>}>
            <Component />
          </Suspense>
        );
      };
    },
  };
});
vi.mock("@/components/settings/sections/appearance-section", () => ({
  AppearanceSection: () => <p>Preferência pessoal</p>,
}));
vi.mock(
  "@/components/settings/sections/personal-notifications-section",
  () => ({ PersonalNotificationsSection: () => <p>Preferências de avisos</p> }),
);
vi.mock("@/components/settings/sections/global-settings-section", () => ({
  GlobalSettingsSection: () => <p>Configuração global</p>,
}));
vi.mock("@/components/settings/sections/users-section", () => ({
  UsersSection: () => <p>Contas administrativas</p>,
}));
function Harness() {
  const { activeTab, setActiveTab } = useActiveTab();
  return (
    <>
      <button onClick={() => setActiveTab("mapa")}>Ir ao mapa</button>
      <output>{activeTab}</output>
      {activeTab === "configuracoes" && <SettingsShell />}
    </>
  );
}
beforeEach(() => {
  auth.allowed = ["settings.access", "settings.personal.edit", "rooms.read"];
  auth.phone = false;
  window.history.replaceState(null, "", "/?modulo=configuracoes");
});
describe("Navegação de configurações", () => {
  it("filtra seções e busca por permissão; segue URL e volta pelo histórico", async () => {
    render(
      <ActiveTabProvider>
        <Harness />
      </ActiveTabProvider>,
    );
    await screen.findByText("Preferência pessoal");
    expect(
      screen.queryByRole("link", { name: "Usuários e acessos" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Meus avisos" }));
    await screen.findByText("Preferências de avisos");
    expect(window.location.search).toContain("secao=avisos");
    fireEvent.change(screen.getByLabelText("Buscar configuração"), {
      target: { value: "usuários" },
    });
    expect(screen.getByText("Nenhuma configuração encontrada.")).toBeTruthy();
    fireEvent.click(screen.getByText("Ir ao mapa"));
    expect(screen.getByText("mapa")).toBeTruthy();
    window.history.replaceState(
      null,
      "",
      "/?modulo=configuracoes&secao=avisos",
    );
    fireEvent(window, new PopStateEvent("popstate"));
    await screen.findByText("Preferências de avisos");
  });
  it("mobile abre lista, mostra seção e volta à lista sem abas horizontais", async () => {
    auth.phone = true;
    render(
      <ActiveTabProvider>
        <Harness />
      </ActiveTabProvider>,
    );
    const link = await screen.findByRole("link", {
      name: /Aparência e visualização/,
    });
    expect(screen.queryByText("Preferência pessoal")).toBeNull();
    fireEvent.click(link);
    await screen.findByText("Preferência pessoal");
    expect(screen.queryByLabelText("Buscar configuração")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar às configurações" }),
    );
    expect(await screen.findByLabelText("Buscar configuração")).toBeTruthy();
  });
  it("link bloqueado cai na primeira seção permitida; Administração antigo vira destino único", async () => {
    window.history.replaceState(
      null,
      "",
      "/?modulo=administracao&secao=usuarios",
    );
    render(
      <ActiveTabProvider>
        <Harness />
      </ActiveTabProvider>,
    );
    await screen.findByText("Preferência pessoal");
    await waitFor(() =>
      expect(window.location.search).toContain("modulo=configuracoes"),
    );
    expect(window.location.search).not.toContain("usuarios");
    expect(screen.queryByText("Contas administrativas")).toBeNull();
  });
});
