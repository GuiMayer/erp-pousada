import type { RoomStatus } from "./store";
export type StayIntent =
  | "overview"
  | "payment"
  | "checkout"
  | "transfer"
  | "occupants"
  | "extend";
export type RoomActionId =
  | "checkin"
  | "block"
  | "checkout"
  | "consumption"
  | "release"
  | "unblock"
  | "receive"
  | "overview"
  | "extend"
  | "transfer"
  | "occupants"
  | "details";
export type RoomAction = {
  id: RoomActionId;
  label: string;
  enabled: boolean;
  reason?: string;
};
export type RoomActionContext = {
  status: RoomStatus;
  hasStay: boolean;
  hasLegacyReservation: boolean;
  balance: number;
  regularStay: boolean;
  occupancyKnown: boolean;
  ambiguous: boolean;
  pending: boolean;
};
const primary: Record<
  RoomStatus,
  { id: RoomActionId; label: string; permissions: string[] }[]
> = {
  disponivel: [
    { id: "checkin", label: "Check-in", permissions: ["hospitality.checkin"] },
    { id: "block", label: "Bloquear", permissions: ["rooms.edit"] },
  ],
  ocupado: [
    {
      id: "checkout",
      label: "Check-out",
      permissions: ["hospitality.checkout"],
    },
    { id: "consumption", label: "Consumo", permissions: ["consumptions.read"] },
  ],
  limpeza: [
    {
      id: "release",
      label: "Liberar quarto",
      permissions: ["hospitality.release"],
    },
  ],
  bloqueado: [
    { id: "unblock", label: "Desbloquear quarto", permissions: ["rooms.edit"] },
  ],
};
export function roomActionLists(
  context: RoomActionContext,
  can: (permission: string) => boolean,
) {
  const all = (permissions: string[]) => permissions.every(can);
  const action = (
    id: RoomActionId,
    label: string,
    regular = false,
  ): RoomAction => ({
    id,
    label,
    enabled:
      !context.pending &&
      !context.ambiguous &&
      (!regular ||
        (id === "extend" ? context.regularStay : context.occupancyKnown)),
    reason: context.ambiguous
      ? "A ocupação precisa de revisão."
      : regular &&
          !(id === "extend" ? context.regularStay : context.occupancyKnown)
        ? "Regularize a ocupação e as diárias antes de continuar."
        : undefined,
  });
  const main = primary[context.status]
    .filter((a) => all(a.permissions))
    .map((a) => action(a.id, a.label));
  const secondary: RoomAction[] = [];
  if (context.status === "ocupado" && !context.ambiguous) {
    const readable = context.hasStay && can("stays.read");
    if (
      (readable ||
        (context.hasLegacyReservation && can("reservations.read"))) &&
      context.balance > 0 &&
      can("hospitality.receive")
    )
      secondary.push(action("receive", "Receber pagamento"));
    if (readable) {
      secondary.push(action("overview", "Ver hospedagem e extrato"));
      if (all(["hospitality.extend", "rooms.read", "lodgingTariffs.read"]))
        secondary.push(action("extend", "Prorrogar estadia", true));
      if (can("hospitality.transfer"))
        secondary.push(action("transfer", "Trocar de quarto", true));
      if (can("hospitality.occupants"))
        secondary.push(action("occupants", "Editar ocupantes", true));
    }
  } else if (context.status !== "ocupado" && can("rooms.read")) {
    secondary.push(
      action(
        "details",
        context.status === "bloqueado"
          ? "Ver bloqueio"
          : "Ver detalhes do quarto",
      ),
    );
  }
  return { primary: main, secondary };
}
