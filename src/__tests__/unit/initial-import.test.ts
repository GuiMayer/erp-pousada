import { describe, it, expect } from "vitest";
import { parseImportCSV, importTemplate, csvCell } from "@/lib/initial-import";
import { notificationDestination } from "@/lib/notification-destination";
describe("S6: importação e destino", () => {
  it("interpreta CSV com BOM, aspas, separadores internos e linha dentro de campo", () => {
    const rows = parseImportCSV(
      importTemplate("people") +
        '"Ana; Maria";52998224725;hospede;11999999999;;\r\n"Nome\ncomposto";11144477735;pagador;;;\r\n',
      "people",
    );
    expect(rows[0].nome).toBe("Ana; Maria");
    expect(rows[1].nome).toBe("Nome\ncomposto");
  });
  it("recusa colunas extras, CSV inválido e mais de 100 registros", () => {
    expect(() =>
      parseImportCSV("nome;documento;senha\nAna;123;senha", "people"),
    ).toThrow("Cabeçalho");
    expect(() =>
      parseImportCSV(importTemplate("people") + '"aberto', "people"),
    ).toThrow("Aspas");
    expect(() =>
      parseImportCSV(
        importTemplate("people") + "Ana;52998224725;hospede;;;\n".repeat(101),
        "people",
      ),
    ).toThrow("100 linhas");
    expect(csvCell("=HYPERLINK() ")).toContain("'=HYPERLINK");
  });
  it("encaminha condição ao registro e mantém compatibilidade sem inferir tipo por texto", () => {
    expect(
      notificationDestination({
        module: "estoque",
        conditionKey: "expiry:x",
        reference: "x",
      }),
    ).toEqual({ module: "estoque", section: "lots", id: "x" });
    expect(
      notificationDestination({
        module: "estoque",
        conditionKey: "stock:x",
        reference: "x",
      })?.section,
    ).toBe("movements");
    expect(
      notificationDestination({ module: "estoque", reference: "x" }),
    ).toBeUndefined();
  });
});
