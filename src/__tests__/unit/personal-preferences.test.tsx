import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UserPreferencesProvider,
  useUserPreferences,
} from "@/contexts/user-preferences-context";
const auth = vi.hoisted(() => ({
  user: { id: "a" },
  allowed: true,
  setTheme: vi.fn(),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: auth.user, can: () => auth.allowed }),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: auth.setTheme }),
}));
beforeEach(() => {
  localStorage.clear();
  auth.user = { id: "a" };
  auth.allowed = true;
  auth.setTheme.mockReset();
});
describe("Preferências pessoais no navegador", () => {
  it("lê antes de gravar, aplica tema e isola contas do mesmo navegador", async () => {
    const key = `erp:preferences:${window.location.origin}:a`;
    localStorage.setItem(
      key,
      JSON.stringify({
        enableChartAnimations: false,
        theme: "dark",
      }),
    );
    const first = renderHook(useUserPreferences, {
      wrapper: UserPreferencesProvider,
    });
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    expect(first.result.current.preferences.theme).toBe("dark");
    expect(auth.setTheme).toHaveBeenCalledWith("dark");
    expect(first.result.current.preferences.enableChartAnimations).toBe(false);
    first.unmount();
    auth.user = { id: "b" };
    const second = renderHook(useUserPreferences, {
      wrapper: UserPreferencesProvider,
    });
    expect(second.result.current.preferences.theme).toBe("system");
    expect(second.result.current.preferences.enableChartAnimations).toBe(true);
    expect(JSON.parse(localStorage.getItem(key)!).enableChartAnimations).toBe(false);
  });
  it("migra preferências legadas somente para a primeira conta e respeita revogação", async () => {
    localStorage.setItem(
      "userPreferences",
      JSON.stringify({ enableChartAnimations: false }),
    );
    const first = renderHook(useUserPreferences, {
      wrapper: UserPreferencesProvider,
    });
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    expect(first.result.current.preferences.enableChartAnimations).toBe(false);
    first.unmount();
    auth.user = { id: "b" };
    auth.allowed = false;
    const second = renderHook(useUserPreferences, {
      wrapper: UserPreferencesProvider,
    });
    act(() => second.result.current.updatePreference("enableChartAnimations", false));
    expect(second.result.current.preferences.enableChartAnimations).toBe(true);
    expect(second.result.current.status).toContain("Sem permissão");
  });
});
