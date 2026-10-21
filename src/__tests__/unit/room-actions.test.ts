import { describe, it, expect } from "vitest";
import { roomActionLists, type RoomActionContext } from "@/lib/room-actions";
import {
  extensionDateError,
  extensionQuoteSignature,
} from "@/lib/stay-extension";
const context: RoomActionContext = {
  status: "ocupado",
  hasStay: true,
  hasLegacyReservation: false,
  balance: 210,
  regularStay: true,
  occupancyKnown: true,
  ambiguous: false,
  pending: false,
};
describe("Ações contextuais dos quartos", () => {
  it("preserva os atalhos por estado e não oferece operações de estadia em quarto livre", () => {
    for (const [status, expected] of Object.entries({
      disponivel: ["checkin", "block"],
      ocupado: ["checkout", "consumption"],
      limpeza: ["release"],
      bloqueado: ["unblock"],
    })) {
      const result = roomActionLists(
        { ...context, status: status as RoomActionContext["status"] },
        () => true,
      );
      expect(result.primary.map((a) => a.id)).toEqual(expected);
      if (status !== "ocupado")
        expect(result.secondary.map((a) => a.id)).toEqual(["details"]);
    }
  });
  it("ordem é estável; quitação e ausência de autorização removem recebimento", () => {
    expect(
      roomActionLists(context, () => true).secondary.map((a) => a.id),
    ).toEqual(["receive", "overview", "extend", "transfer", "occupants"]);
    for (const config of [
      { ...context, balance: 0 },
      { ...context, balance: -5 },
    ])
      expect(
        roomActionLists(config, () => true).secondary.some(
          (a) => a.id === "receive",
        ),
      ).toBe(false);
    expect(
      roomActionLists(
        context,
        (p) => p !== "hospitality.receive",
      ).secondary.some((a) => a.id === "receive"),
    ).toBe(false);
  });
  it("somente leitura não ganha comandos; sem leitura não expõe extrato ou conta", () => {
    const readOnly = new Set(["rooms.read", "stays.read"]);
    const result = roomActionLists(context, (p) => readOnly.has(p));
    expect(result.primary).toHaveLength(0);
    expect(result.secondary.map((a) => a.id)).toEqual(["overview"]);
    expect(roomActionLists(context, () => false).secondary).toHaveLength(0);
  });
  it("inconsistência bloqueia atalhos; dados legados não impedem tarefas já compatíveis", () => {
    expect(
      roomActionLists(
        { ...context, ambiguous: true },
        () => true,
      ).primary.every((a) => !a.enabled),
    ).toBe(true);
    expect(
      roomActionLists({ ...context, ambiguous: true }, () => true).secondary,
    ).toHaveLength(0);
    const items = roomActionLists(
      { ...context, regularStay: false },
      () => true,
    ).secondary;
    expect(items.find((a) => a.id === "extend")?.enabled).toBe(false);
    expect(items.find((a) => a.id === "transfer")?.enabled).toBe(true);
    expect(items.find((a) => a.id === "occupants")?.enabled).toBe(true);
  });
  it("não apresenta ações modernas para reserva sem estadia e mantém recebimento legado", () => {
    const items = roomActionLists(
      {
        ...context,
        hasStay: false,
        hasLegacyReservation: true,
        regularStay: false,
      },
      () => true,
    ).secondary;
    expect(items.map((a) => a.id)).toEqual(["receive"]);
  });
  it("prévia distingue versão de tarifa com o mesmo preço e valida a nova saída", () => {
    const quote = {
      total: 200,
      nights: [
        {
          date: "2026-10-13",
          guests: 2,
          pricePerPerson: 100,
          total: 200,
          tariffId: "t",
          tariffVersion: 0,
          tariffName: "A",
        },
      ],
    };
    expect(extensionQuoteSignature(quote)).not.toBe(
      extensionQuoteSignature({
        ...quote,
        nights: [{ ...quote.nights[0], tariffVersion: 1 }],
      }),
    );
    expect(
      extensionDateError("2026-10-12", "2026-10-13", "2026-10-12"),
    ).toBeUndefined();
    expect(
      extensionDateError("2026-10-11", "2026-10-12", "2026-10-12"),
    ).toBeDefined();
    expect(
      extensionDateError("2026-10-12", "2026-02-30", "2026-10-12"),
    ).toBeDefined();
  });
});
