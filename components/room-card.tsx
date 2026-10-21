"use client";
import { useMemo, useRef, useState } from "react";
import {
  User,
  CalendarClock,
  DoorOpen,
  Lock,
  BedDouble,
  SprayCan,
  LogIn,
  LogOut,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { MiniTimeline } from "./mini-timeline";
import { BlockRoomModal } from "./block-room-modal";
import { CheckinModal } from "./checkin-modal";
import { ConsumptionSheet } from "./consumption-sheet";
import { StaySheet } from "./stay-sheet";
import { ReservationPaymentDialog } from "./reservation-payment-button";
import { RoomActionsMenu } from "./room-actions-menu";
import {
  roomActionLists,
  type RoomActionId,
  type StayIntent,
} from "@/lib/room-actions";
import { stayBalance, type Stay } from "@/lib/stays";
import type { Room, RoomStatus, Reservation } from "@/lib/store";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notification-context";
import { useToast } from "@/hooks/use-toast";
import { getDataConfig } from "@/lib/data/config";
import { formatCurrency } from "@/lib/utils/formatters";
const statusConfig = {
  disponivel: {
    label: "Disponível",
    badge: "bg-success text-success-foreground",
    border: "border-success/30",
    accent: "bg-success",
    icon: DoorOpen,
  },
  ocupado: {
    label: "Ocupado",
    badge: "bg-warning text-warning-foreground",
    border: "border-warning/30",
    accent: "bg-warning",
    icon: BedDouble,
  },
  limpeza: {
    label: "Limpeza",
    badge: "bg-cleaning text-cleaning-foreground",
    border: "border-cleaning/30",
    accent: "bg-cleaning",
    icon: SprayCan,
  },
  bloqueado: {
    label: "Bloqueado",
    badge: "bg-info text-info-foreground",
    border: "border-info/30",
    accent: "bg-info",
    icon: Lock,
  },
} satisfies Record<RoomStatus, object>;
const icons = {
  checkin: LogIn,
  block: Lock,
  checkout: LogOut,
  consumption: ShoppingCart,
  release: CheckCircle2,
  unblock: Lock,
};
type Task =
  | { kind: "stay"; stay: Stay; intent: StayIntent }
  | { kind: "legacyPayment"; reservation: Reservation }
  | { kind: "checkin" }
  | { kind: "consumption" }
  | { kind: "block"; room: Room }
  | { kind: "details"; room: Room };
const dateBR = (day: string) =>
  new Date(day + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
function daysUntil(day: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(day + "T12:00:00");
  end.setHours(0, 0, 0, 0);
  const days = Math.ceil((end.getTime() - today.getTime()) / 86400000);
  return days === 0
    ? "Hoje"
    : days === 1
      ? "Amanhã"
      : days < 0
        ? Math.abs(days) + "d atrasado"
        : days + " dias";
}
export function RoomCard({
  room,
  selectedDate,
}: {
  room: Room;
  selectedDate: string;
}) {
  const {
    stays = [],
    reservations,
    runOperation,
    updateRoom,
    addAuditEntry,
    getConsumption,
    clearConsumption,
    getRoomTimeline,
  } = useApp();
  const { can, username } = useAuth(),
    { sendNotification } = useNotifications(),
    { toast } = useToast();
  const [task, setTask] = useState<Task | null>(null),
    [pending, setPending] = useState(false);
  const busy = useRef(false),
    card = useRef<HTMLDivElement>(null),
    origin = useRef<HTMLButtonElement | null>(null);
  const config = statusConfig[room.status],
    StatusIcon = config.icon;
  const occupied = room.status === "ocupado",
    overdue =
      occupied &&
      !!room.checkOut &&
      new Date() >
        new Date(room.checkOut + "T" + (room.checkOutTime || "12:00") + ":00");
  const candidates = occupied
    ? stays.filter((s) => s.roomId === room.id && s.status === "active")
    : [];
  const bookings = occupied
    ? reservations.filter((r) => r.roomId === room.id && r.status === "checkin")
    : [];
  const ambiguous = candidates.length > 1 || bookings.length > 1;
  const stay = !ambiguous && can("stays.read") ? candidates[0] : undefined;
  const legacy =
    !ambiguous && !stay && can("reservations.read") ? bookings[0] : undefined;
  const consumption = getConsumption(room.id);
  const legacyConsumption =
    consumption?.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) ??
    0;
  const balances = stay ? stayBalance(stay) : undefined;
  const consumptionTotal = balances?.consumption ?? legacyConsumption;
  const balance =
    balances?.balance ??
    (legacy ? Math.max(0, legacy.totalValue - (legacy.paidValue ?? 0)) : 0);
  const lists = roomActionLists(
    {
      status: room.status,
      hasStay: !!stay,
      hasLegacyReservation: !!legacy,
      balance,
      regularStay: !!stay?.guestCount && !!stay.nightlyPrices?.length,
      occupancyKnown: !!stay?.guestCount,
      ambiguous,
      pending,
    },
    can,
  );
  const timeline = useMemo(
    () => getRoomTimeline(room.id, selectedDate, 7),
    [room.id, selectedDate, getRoomTimeline],
  );
  function closeTask() {
    if (busy.current) return;
    setTask(null);
    requestAnimationFrame(() => {
      if (origin.current?.isConnected) origin.current.focus();
      else card.current?.querySelector<HTMLButtonElement>("button")?.focus();
    });
  }
  async function mutate(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await action();
    } catch (e) {
      toast({
        title: "Operação não concluída",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function openAction(id: RoomActionId) {
    const action = [...lists.primary, ...lists.secondary].find(
      (a) => a.id === id,
    );
    if (!action?.enabled || busy.current) return;
    if (!origin.current?.isConnected)
      origin.current =
        card.current?.querySelector<HTMLButtonElement>(
          '[data-slot="dropdown-menu-trigger"]',
        ) ?? null;
    const intents: Partial<Record<RoomActionId, StayIntent>> = {
      overview: "overview",
      receive: "payment",
      checkout: "checkout",
      transfer: "transfer",
      occupants: "occupants",
      extend: "extend",
    };
    if (stay && intents[id]) {
      setTask({
        kind: "stay",
        stay: structuredClone(stay),
        intent: intents[id]!,
      });
      return;
    }
    if (id === "receive" && legacy) {
      setTask({ kind: "legacyPayment", reservation: structuredClone(legacy) });
      return;
    }
    if (id === "checkin" || id === "consumption") {
      setTask({ kind: id });
      return;
    }
    if (id === "block" || id === "unblock") {
      setTask({ kind: "block", room: structuredClone(room) });
      return;
    }
    if (id === "details") {
      setTask({ kind: "details", room: structuredClone(room) });
      return;
    }
    if (id === "release")
      void mutate(async () => {
        await updateRoom(room.id, {
          recordVersion: room.recordVersion,
          status: "disponivel",
        });
        addAuditEntry({
          user: username || "sistema",
          action: "Quarto liberado (limpeza concluída)",
          reference: "Quarto " + room.number,
        });
        sendNotification(
          "cleaning",
          "Limpeza concluída",
          "Quarto " + room.number + " disponível.",
          "low",
          String(room.id),
        );
      });
    if (id === "checkout")
      void mutate(async () => {
        if (legacyConsumption > 0)
          throw Error("Quite o consumo antes do check-out.");
        if (getDataConfig().adapter === "database")
          await runOperation("check-out", { roomId: room.id });
        else {
          await updateRoom(room.id, {
            recordVersion: room.recordVersion,
            status: "limpeza",
            guest: undefined,
            guestCpf: undefined,
            checkIn: undefined,
            checkOut: undefined,
          });
          await clearConsumption(room.id);
          addAuditEntry({
            user: username || "sistema",
            action: "Check-out realizado",
            reference: "Quarto " + room.number,
          });
        }
        sendNotification(
          "check-out",
          "Check-out realizado",
          "Quarto " + room.number + " liberado para limpeza.",
          "medium",
          String(room.id),
        );
      });
  }
  const more = (
    <RoomActionsMenu
      roomNumber={room.number}
      actions={lists.secondary}
      disabled={pending}
      onAction={(id) => {
        origin.current =
          card.current?.querySelector<HTMLButtonElement>(
            '[data-slot="dropdown-menu-trigger"]',
          ) ?? null;
        openAction(id);
      }}
    />
  );
  return (
    <>
      <Card
        ref={card}
        className={`mobile-room-card room-summary-card relative gap-0 overflow-hidden py-3 transition-shadow motion-reduce:transition-none hover:shadow-md sm:h-full ${config.border}`}
      >
        <div className={`absolute inset-x-0 top-0 h-1 ${config.accent}`} />
        <CardHeader className="px-3 pb-0 pt-1 sm:shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {room.number}
              </span>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                {room.type}
              </span>
            </div>
            <Badge
              className={`shrink-0 gap-1 border-transparent text-[11px] ${overdue ? "bg-destructive text-white dark:bg-destructive-solid" : config.badge}`}
            >
              {overdue ? (
                <AlertTriangle className="size-3" />
              ) : (
                <StatusIcon className="size-3" />
              )}
              {overdue ? "Atrasado" : config.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-3 py-0 sm:flex sm:flex-1 sm:flex-col">
          <div className={`mt-2 rounded-lg bg-secondary/60 px-2 py-1.5 sm:flex sm:flex-1 sm:flex-col ${occupied ? "" : "sm:justify-center"}`}>
            <div className="flex items-center justify-between gap-1">
              {occupied ? (
                <div className="flex min-w-0 items-center gap-2">
                  <User className="size-3.5 shrink-0 text-muted-foreground" />
                  {stay ? (
                    <button
                      type="button"
                      className="flex min-h-11 min-w-0 items-center gap-1 rounded text-left text-sm font-medium hover:underline focus-visible:outline focus-visible:outline-2"
                      aria-label={`Abrir hospedagem do quarto ${room.number}`}
                      onClick={(e) => {
                        origin.current = e.currentTarget;
                        openAction("overview");
                      }}
                    >
                      <span className="line-clamp-2 break-words">
                        {room.guest || stay.guestName}
                      </span>
                      <ChevronRight className="size-3.5 shrink-0" />
                    </button>
                  ) : (
                    <span className="min-h-11 content-center break-words text-sm font-medium">
                      {room.guest || "Hóspede"}
                    </span>
                  )}
                </div>
              ) : (
                <span className="min-h-11 min-w-0 content-center break-words text-sm">
                  {room.status === "disponivel"
                    ? "Disponível para entrada"
                    : room.status === "limpeza"
                      ? "Aguardando limpeza"
                      : room.blockReason || "Bloqueado"}
                </span>
              )}
              {more}
            </div>
            {occupied && room.checkOut && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5 shrink-0" />
                <span>
                  Saída:{" "}
                  <strong className="font-medium text-foreground">
                    {dateBR(room.checkOut)}
                  </strong>{" "}
                  · <span className={overdue ? "font-semibold text-destructive" : undefined}>{daysUntil(room.checkOut)}</span>
                </span>
              </p>
            )}
            {occupied &&
              can("consumptions.read") &&
              consumptionTotal > 0 &&
              !ambiguous && (
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <ShoppingCart className="size-3.5" />
                  Consumo:{" "}
                  <strong className="text-foreground">
                    {formatCurrency(consumptionTotal)}
                  </strong>
                </p>
              )}
            {room.status === "bloqueado" && room.blockEndDate && (
              <p className="text-xs text-muted-foreground">
                Previsão: {dateBR(room.blockEndDate)}
              </p>
            )}
            {occupied && !ambiguous && (stay || legacy) && (
              <div className="mt-1 sm:mt-auto sm:pt-1">
                {balance > 0 ? (
                  lists.secondary.some((a) => a.id === "receive") ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="flex min-h-11 w-full flex-wrap items-center justify-between gap-1 rounded text-left text-xs hover:underline focus-visible:outline focus-visible:outline-2"
                      aria-label={`Receber pagamento do quarto ${room.number}`}
                      onClick={(e) => {
                        origin.current = e.currentTarget;
                        openAction("receive");
                      }}
                    >
                      <span>
                        {stay ? "Saldo total a receber" : "Diárias a receber"}
                      </span>
                      <strong className="flex items-center gap-1 text-sm">
                        {formatCurrency(balance)}
                        <ChevronRight className="size-3.5" />
                      </strong>
                    </button>
                  ) : (
                    <p className="flex min-h-11 flex-wrap items-center justify-between gap-1 text-xs">
                      <span>
                        {stay ? "Saldo total a receber" : "Diárias a receber"}
                      </span>
                      <strong className="text-sm">
                        {formatCurrency(balance)}
                      </strong>
                    </p>
                  )
                ) : (
                  <p className="min-h-11 content-center text-xs text-muted-foreground">
                    {balance < 0 ? "Crédito a conciliar" : "Hospedagem quitada"}
                  </p>
                )}
              </div>
            )}
            {ambiguous && (
              <p role="alert" className="py-2 text-xs text-destructive">
                A ocupação precisa de revisão. Solicite ao administrador.
              </p>
            )}
          </div>
            <div className={`mt-2 gap-2 sm:min-h-11 sm:shrink-0 ${lists.primary.length > 0 ? "flex" : "hidden sm:flex"}`}>
              {lists.primary.map((action) => {
                const Icon = icons[action.id as keyof typeof icons];
                return (
                  <Button
                    key={action.id}
                    size="sm"
                    variant="outline"
                    disabled={!action.enabled}
                    className="min-h-11 min-w-0 flex-1 gap-1.5 px-2 text-xs"
                    onClick={(e) => {
                      origin.current = e.currentTarget;
                      openAction(action.id);
                    }}
                  >
                    {Icon && <Icon className="size-3.5" />}
                    {action.label}
                  </Button>
                );
              })}
            </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch px-3 pb-0 pt-0 sm:shrink-0">
          <Separator className="my-3" />
          <MiniTimeline days={timeline} highlightDate={selectedDate} />
        </CardFooter>
      </Card>
      {task?.kind === "stay" && (
        <StaySheet
          key={task.stay.id}
          stay={task.stay}
          initialIntent={task.intent}
          onClose={closeTask}
        />
      )}
      {task?.kind === "legacyPayment" && (
        <ReservationPaymentDialog
          reservation={task.reservation}
          open
          onClose={closeTask}
        />
      )}
      {task?.kind === "checkin" && (
        <CheckinModal room={room} open onClose={closeTask} />
      )}
      {task?.kind === "consumption" && (
        <ConsumptionSheet room={room} open onClose={closeTask} />
      )}
      {task?.kind === "block" && (
        <BlockRoomModal
          room={task.room}
          open
          pending={pending}
          onClose={closeTask}
          onConfirmBlock={(end, responsible, reason) =>
            void mutate(async () => {
              if (!can("rooms.edit"))
                throw Error("Sem permissão para bloquear.");
              await updateRoom(room.id, {
                recordVersion: task.room.recordVersion,
                status: "bloqueado",
                blockEndDate: end,
                blockResponsible: responsible,
                blockReason: reason,
              });
              addAuditEntry({
                user: username || "sistema",
                action: "Quarto bloqueado",
                reference: "Quarto " + room.number + " · " + reason,
              });
              setTask(null);
            })
          }
          onUnblock={() =>
            void mutate(async () => {
              if (!can("rooms.edit"))
                throw Error("Sem permissão para desbloquear.");
              await updateRoom(room.id, {
                recordVersion: task.room.recordVersion,
                status: "disponivel",
                blockEndDate: undefined,
                blockResponsible: undefined,
                blockReason: undefined,
              });
              addAuditEntry({
                user: username || "sistema",
                action: "Quarto desbloqueado",
                reference: "Quarto " + room.number,
              });
              setTask(null);
            })
          }
        />
      )}
      {task?.kind === "details" && (
        <Dialog
          open
          onOpenChange={(value) => {
            if (!value) closeTask();
          }}
        >
          <DialogContent mobileTask>
            <DialogHeader>
              <DialogTitle>Quarto {task.room.number}</DialogTitle>
              <DialogDescription>
                {statusConfig[task.room.status].label} · {task.room.type}
              </DialogDescription>
            </DialogHeader>
            <dl className="space-y-3 text-sm">
              <div>
                <dt>Capacidade</dt>
                <dd>{task.room.capacity ?? "Não configurada"} pessoa(s)</dd>
              </div>
              {task.room.status === "bloqueado" && (
                <>
                  <div>
                    <dt>Motivo</dt>
                    <dd>{task.room.blockReason || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt>Responsável</dt>
                    <dd>{task.room.blockResponsible || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt>Previsão</dt>
                    <dd>
                      {task.room.blockEndDate
                        ? dateBR(task.room.blockEndDate)
                        : "Não informada"}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <Button variant="outline" onClick={closeTask}>
              Fechar
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
