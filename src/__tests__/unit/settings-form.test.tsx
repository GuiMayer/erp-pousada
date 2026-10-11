import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { TaskDraftProvider } from "@/contexts/task-drafts-context";
import { GlobalSettingsSection } from "@/components/settings/sections/global-settings-section";
const state = vi.hoisted(() => ({
  allowed: [
    "settings.access",
    "settings.lodging.read",
    "settings.lodging.edit",
  ],
  runOperation: vi.fn(),
  guard: null as null | ((proceed: () => void) => boolean),
  register: vi.fn(),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    can: (permission: string) => state.allowed.includes(permission),
  }),
}));
vi.mock("@/lib/app-context", () => ({
  useApp: () => ({
    systemSettings: { id: "s", recordVersion: 7 },
    runOperation: state.runOperation,
  }),
}));
vi.mock("@/contexts/active-tab-context", () => ({
  useActiveTab: () => ({ registerNavigationGuard: state.register }),
}));
beforeEach(() => {
  state.allowed = [
    "settings.access",
    "settings.lodging.read",
    "settings.lodging.edit",
  ];
  state.runOperation.mockReset();
  state.register.mockImplementation((guard) => {
    state.guard = guard;
    return () => {
      state.guard = null;
    };
  });
  vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "database");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        recordVersion: 7,
        values: { checkInTime: "14:00", checkOutTime: "12:00" },
      }),
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const renderForm = () =>
  render(
    <TaskDraftProvider>
      <GlobalSettingsSection section="hospedagem" />
    </TaskDraftProvider>,
  );
describe("Formulário por seção", () => {
  it("aceita leitura mais recente que o cache operacional sem repetir consultas", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        recordVersion: 9,
        values: { checkInTime: "16:00", checkOutTime: "12:00" },
      }),
    } as Response);
    const view = renderForm();
    await screen.findByText("Versão 9");
    view.rerender(
      <TaskDraftProvider>
        <GlobalSettingsSection section="hospedagem" />
      </TaskDraftProvider>,
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Horário de check-in")).toHaveValue("16:00");
  });
  it("atualização bloqueia edição durante leitura e preserva rascunho para revisão", async () => {
    renderForm();
    const field = await screen.findByLabelText("Horário de check-in");
    fireEvent.change(field, { target: { value: "15:00" } });
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Atualizar valores" }));
    expect(field).toBeDisabled();
    expect(state.guard!(vi.fn())).toBe(false);
    resolve({
      ok: true,
      json: async () => ({
        recordVersion: 9,
        values: { checkInTime: "16:00", checkOutTime: "12:00" },
      }),
    } as Response);
    await screen.findByRole("region", { name: "Revisão de conflito" });
    expect(field).toHaveValue("15:00");
    fireEvent.click(
      screen.getByRole("button", { name: "Manter meu rascunho para revisão" }),
    );
    await screen.findByText("Versão 9");
    expect(state.runOperation).not.toHaveBeenCalled();
    state.runOperation.mockResolvedValueOnce({
      recordVersion: 10,
      values: { checkInTime: "15:00", checkOutTime: "12:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await screen.findByText("Alterações salvas.");
    expect(state.runOperation).toHaveBeenCalledWith("settings-update", {
      section: "hospedagem",
      recordVersion: 9,
      values: { checkInTime: "15:00", checkOutTime: "12:00" },
    });
  });
  it("mantém rascunho na falha; envia versão e somente campos desta seção", async () => {
    state.runOperation
      .mockRejectedValueOnce(Error("Alterado em outra sessão"))
      .mockResolvedValueOnce({
        recordVersion: 8,
        values: { checkInTime: "15:00", checkOutTime: "12:00" },
      });
    renderForm();
    const field = await screen.findByLabelText("Horário de check-in");
    fireEvent.change(field, { target: { value: "15:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await screen.findByText("Alterado em outra sessão");
    expect(field).toHaveValue("15:00");
    expect(state.runOperation).toHaveBeenCalledWith("settings-update", {
      section: "hospedagem",
      recordVersion: 7,
      values: { checkInTime: "15:00", checkOutTime: "12:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await screen.findByText("Alterações salvas.");
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeDisabled();
  });
  it("consulta não oferece ações de escrita e não marca carregamento como rascunho pendente", async () => {
    state.allowed = ["settings.access", "settings.lodging.read"];
    renderForm();
    expect(await screen.findByLabelText("Horário de check-in")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Salvar alterações" }),
    ).toBeNull();
    const proceed = vi.fn();
    expect(state.guard!(proceed)).toBe(true);
    expect(state.runOperation).not.toHaveBeenCalled();
  });
  it("saída exige decisão e recusa novo envio enquanto a confirmação está pendente", async () => {
    let resolve!: (value: unknown) => void;
    state.runOperation.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    renderForm();
    fireEvent.change(await screen.findByLabelText("Horário de check-in"), {
      target: { value: "15:00" },
    });
    const proceed = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(state.runOperation).toHaveBeenCalledOnce());
    expect(state.guard!(proceed)).toBe(false);
    expect(proceed).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Horário de check-in")).toBeDisabled();
    resolve({
      recordVersion: 8,
      values: { checkInTime: "15:00", checkOutTime: "12:00" },
    });
    await screen.findByText("Alterações salvas.");
  });
  it("preserva edição ao escolher permanecer e descarta explicitamente antes de sair", async () => {
    renderForm();
    fireEvent.change(await screen.findByLabelText("Horário de check-in"), {
      target: { value: "16:00" },
    });
    const proceed = vi.fn();
    fireEvent.click(screen.getByLabelText("Horário de check-in"));
    const eventButton = document.createElement("button");
    eventButton.onclick = () => {
      expect(state.guard!(proceed)).toBe(false);
    };
    document.body.appendChild(eventButton);
    fireEvent.click(eventButton);
    await screen.findByText("Há alterações não salvas");
    fireEvent.click(screen.getByRole("button", { name: "Permanecer" }));
    expect(screen.getByLabelText("Horário de check-in")).toHaveValue("16:00");
    expect(proceed).not.toHaveBeenCalled();
    fireEvent.click(eventButton);
    fireEvent.click(
      await screen.findByRole("button", { name: "Descartar e sair" }),
    );
    expect(proceed).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Horário de check-in")).toHaveValue("14:00");
    eventButton.remove();
  });
});
