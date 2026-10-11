import { describe, it, expect, vi, afterEach } from "vitest";
import { matchesPerson } from "@/lib/utils/person-search";
import {
  stockAvailable,
  validateStockAvailability,
} from "@/lib/utils/stock-validation";
import type { StockItem } from "@/lib/store";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("S6: consulta e disponibilidade", () => {
  it("busca telefone com máscara e não mescla documentos", () => {
    expect(
      matchesPerson({ name: "Ana", phone: "(11) 99999-1234" }, "11999991234"),
    ).toBe(true);
    expect(
      matchesPerson({ name: "Ana", phone2: "(11) 5555-6789" }, "5555-6789"),
    ).toBe(true);
    expect(matchesPerson({ name: "Ana", phone: "999" }, "abc999")).toBe(false);
  });
  it("não anuncia físico indisponível ou saldo desconhecido como utilizável", () => {
    const stock = { currentStock: 10, usableStock: 4, unit: "un" } as StockItem;
    expect(validateStockAvailability(stock, 5, "Água", true).isValid).toBe(
      false,
    );
    expect(validateStockAvailability(stock, 4, "Água", true).isValid).toBe(
      true,
    );
    expect(
      stockAvailable({ ...stock, usableStock: undefined }, true),
    ).toBeUndefined();
    expect(validateStockAvailability(undefined, 1, "Água", true).isValid).toBe(
      false,
    );
    expect(
      validateStockAvailability({ ...stock, usableStock: undefined }, 5, "Água")
        .isValid,
    ).toBe(true);
  });
  it("cacheia, coalesce, expira e atualiza consulta sem guardar falha", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01"));
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ cnpj: "11222333000181", razao_social: "Exemplo" }),
        ),
      );
    // Cada chamada precisa de uma resposta cujo corpo ainda não foi consumido.
    fetch.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ cnpj: "11222333000181", razao_social: "Exemplo" }),
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const { lookupCompanyCached } = await import("@/lib/server/company-lookup");
    await Promise.all([
      lookupCompanyCached("11222333000181"),
      lookupCompanyCached("11222333000181"),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await lookupCompanyCached("11222333000181")).cached).toBe(true);
    await lookupCompanyCached("11222333000181", true);
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(86400001);
    await lookupCompanyCached("11222333000181");
    expect(fetch).toHaveBeenCalledTimes(3);
    fetch.mockRejectedValueOnce(new Error("offline"));
    await expect(lookupCompanyCached("11222333000181", true)).rejects.toThrow(
      "indisponível",
    );
    await lookupCompanyCached("11222333000181", true);
    expect(fetch).toHaveBeenCalledTimes(5);
  });
});
