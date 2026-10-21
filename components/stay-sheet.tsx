"use client";
import { getDataConfig } from "@/lib/data/config";
import { useState, useRef, useEffect } from "react";
import type { StayIntent } from "@/lib/room-actions";
import {
  extensionDateError,
  extensionQuoteSignature,
} from "@/lib/stay-extension";
import { useStockNavigation } from "@/contexts/active-tab-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { stayBalance, type Stay } from "@/lib/stays";
import { businessDay } from "@/lib/utils/business-values";
import { formatCurrency } from "@/lib/utils/formatters";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { PaymentDialog } from "./payment-fields";
import { previewLodging, LodgingQuotePreview } from "./lodging-quote-preview";

export function StayButton({
  stay,
  label = "Hospedagem / extrato",
  readOnly = false,
}: {
  stay: Stay;
  label?: string;
  readOnly?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<Stay | null>(null);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setSnapshot(structuredClone(stay))}
      >
        {label}
      </Button>
      {snapshot && (
        <StaySheet stay={snapshot} readOnly={readOnly} onClose={() => setSnapshot(null)} />
      )}
    </>
  );
}
export function StaySheet({
  stay: openedStay,
  onClose,
  initialIntent = "overview",
  readOnly = false,
}: {
  stay: Stay;
  onClose: () => void;
  initialIntent?: StayIntent;
  readOnly?: boolean;
}) {
  const [stay, setStay] = useState(openedStay);
  const [intent, setIntent] = useState<StayIntent>(readOnly ? "overview" : initialIntent);
  const pendingRef = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const [exit, setExit] = useState<(() => void) | null>(null);
  const [extendOut, setExtendOut] = useState(""),
    [extendReason, setExtendReason] = useState(""),
    [extensionConfirmed, setExtensionConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const {
    runOperation,
    rooms,
    customers,
    lodgingTariffs,
    accountsReceivable,
    reservations = [],
  } = useApp();
  const { can } = useAuth();
  const [occupants, setOccupants] = useState(() =>
    Array.from(
      { length: stay.guestCount ?? stay.occupants.length },
      (_, i) => ({
        name: stay.occupants[i]?.name ?? "",
        customerId: stay.occupants[i]?.customerId ?? "",
      }),
    ),
  );
  const [destination, setDestination] = useState(""),
    [reason, setReason] = useState(""),
    [reprice, setReprice] = useState(false);
  const [dueDate, setDueDate] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [payment, setPayment] = useState(!readOnly && initialIntent === "payment"),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const balance = stayBalance(stay),
    active = stay.status === "active";
  const title = accountsReceivable.find((t) => t.sourceStayId === stay.id);
  const payer = customers.find((c) => c.id === stay.payerId);
  const corporatePayer =
    !!payer?.active &&
    payer.cpfCnpj.replace(/[^0-9A-Z]/gi, "").length === 14 &&
    !!payer.roles?.includes("payer");
  const allowedReceive =
    !readOnly && can("hospitality.receive") && (active || can("accountsReceivable.receive"));
  const target = { stayId: stay.id, recordVersion: stay.recordVersion };
  const titles: Record<StayIntent, string> = {
    overview: "Hospedagem",
    payment: "Receber hospedagem",
    checkout: "Check-out",
    transfer: "Trocar de quarto",
    occupants: "Editar ocupantes",
    extend: "Prorrogar estadia",
  };
  const permission: Partial<Record<StayIntent, string>> = {
    payment: "hospitality.receive",
    checkout: "hospitality.checkout",
    transfer: "hospitality.transfer",
    occupants: "hospitality.occupants",
    extend: "hospitality.extend",
  };
  const permitted =
    can("stays.read") &&
    (!permission[intent] || can(permission[intent]!)) &&
    (intent !== "extend" || (can("rooms.read") && can("lodgingTariffs.read")));
  useEffect(() => {
    if (!payment) heading.current?.focus();
  }, [intent, payment]);
  const baseline = Array.from(
    { length: stay.guestCount ?? stay.occupants.length },
    (_, i) => ({
      name: stay.occupants[i]?.name ?? "",
      customerId: stay.occupants[i]?.customerId ?? "",
    }),
  );
  const dirty =
    JSON.stringify(occupants) !== JSON.stringify(baseline) ||
    !!destination ||
    !!reason ||
    !!extendOut ||
    !!extendReason ||
    !!dueDate ||
    confirmed;
  const navigation = useStockNavigation(),
    registerGuard = navigation?.registerNavigationGuard;
  const requestExit = (proceed: () => void) => {
    if (pendingRef.current) return;
    if (dirty) setExit(() => proceed);
    else proceed();
  };
  useEffect(
    () =>
      registerGuard?.((proceed) => {
        if (pendingRef.current) return false;
        if (dirty) {
          setExit(() => proceed);
          return false;
        }
        return true;
      }),
    [registerGuard, dirty],
  );
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const extraPreview = previewLodging(
    rooms.find((r) => r.id === stay.roomId),
    lodgingTariffs,
    stay.guestCount ?? 0,
    stay.checkOut,
    extendOut,
  );
  const quoteMarker = extraPreview.quote
    ? extensionQuoteSignature(extraPreview.quote)
    : "";
  useEffect(() => setExtensionConfirmed(false), [quoteMarker]);
  const extensionError = extendOut
    ? extensionDateError(stay.checkOut, extendOut, businessDay())
    : undefined;
  const extraCollision = reservations.some(
    (r) =>
      r.id !== stay.reservationId &&
      r.roomId === stay.roomId &&
      ["confirmada", "checkin"].includes(r.status) &&
      r.checkIn < extendOut &&
      r.checkOut > stay.checkOut,
  );
  const changeIntent = (next: StayIntent) => requestExit(() => setIntent(next));
  const closePayment = () => {
    setPayment(false);
    if (intent === "payment") setIntent("overview");
  };
  const resetDraft = () => {
    setOccupants(baseline);
    setDestination("");
    setReason("");
    setExtendOut("");
    setExtendReason("");
    setDueDate("");
    setConfirmed(false);
    setExtensionConfirmed(false);
  };

  async function perform(kind: string, payload: object) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      const result = await runOperation<{ stay?: Stay }>(kind, {
        ...target,
        ...payload,
      });
      if (kind === "stay-extend" && result.stay) {
        setStay(result.stay);
        setExtendOut("");
        setExtendReason("");
        setExtensionConfirmed(false);
        setIntent("overview");
        setMessage(
          "Estadia prorrogada. As diárias anteriores e os recebimentos foram preservados.",
        );
        return;
      }
      if (kind === "stay-occupants" && result.stay) {
        setStay(result.stay);
        setMessage("Ocupantes salvos. Você pode continuar o atendimento.");
        return;
      }
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir. Reabra o extrato e tente novamente.",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <Sheet
        open={!payment || !permitted || !allowedReceive || balance.balance <= 0}
        onOpenChange={(open) => {
          if (!open) requestExit(onClose);
        }}
      >
        <SheetContent
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            heading.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
          className="flex w-full flex-col overflow-y-auto sm:max-w-2xl"
        >
          <SheetHeader>
            <SheetTitle ref={heading} tabIndex={-1}>
              {titles[intent]} · {stay.guestName}
            </SheetTitle>
            <SheetDescription>
              {stay.checkIn} a {stay.checkOut} ·{" "}
              {active ? "Em andamento" : "Encerrada"} · Reserva{" "}
              {stay.reservationId}
            </SheetDescription>
          </SheetHeader>
          {permitted ? (
            <fieldset disabled={pending} className="space-y-5 px-4 pb-4">
              <details className="rounded-lg border p-3 text-sm">
                <summary className="cursor-pointer font-medium">Datas e registro da hospedagem</summary>
                <div className="mt-2 space-y-1">
                  {reservations.find(r => r.id === stay.reservationId)?.checkIn && <p>Entrada prevista na reserva: {reservations.find(r => r.id === stay.reservationId)!.checkIn.split("-").reverse().join("/")}</p>}
                  <p>Chegada efetiva: {stay.checkIn.split("-").reverse().join("/")}</p>
                  {reservations.find(r => r.id === stay.reservationId)?.checkOut && <p>Saída prevista na reserva: {reservations.find(r => r.id === stay.reservationId)!.checkOut.split("-").reverse().join("/")}</p>}
                  {stay.endedAt && <p>Saída efetiva: {businessDay(new Date(stay.endedAt)).split("-").reverse().join("/")}</p>}
                  {stay.recordedAt && <p>Registrado em: {new Date(stay.recordedAt).toLocaleString("pt-BR")}</p>}
                  {stay.arrivalReason && <p className="whitespace-pre-wrap break-words">Motivo do lançamento: {stay.arrivalReason}</p>}
                </div>
              </details>
              {intent !== "overview" && (
                <Button
                  variant="outline"
                  onClick={() => changeIntent("overview")}
                >
                  Voltar ao resumo da hospedagem
                </Button>
              )}
              {["overview", "payment", "checkout"].includes(intent) && (
                <section
                  className="space-y-3 rounded-lg border p-4"
                  aria-label="Extrato da hospedagem"
                >
                  <p className="text-sm">
                    Pagador:{" "}
                    <strong>
                      {payer?.name ??
                        stay.payerId ??
                        "Pagador não informado"}
                    </strong>
                  </p>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt>Diárias</dt>
                      <dd>{formatCurrency(stay.lodgingValue)}</dd>
                    </div>
                    <div>
                      <dt>Bebidas e ajustes</dt>
                      <dd>{formatCurrency(balance.consumption)}</dd>
                    </div>
                    <div>
                      <dt>Total acordado</dt>
                      <dd>{formatCurrency(balance.total)}</dd>
                    </div>
                    <div>
                      <dt>Sinal e recebimentos</dt>
                      <dd>{formatCurrency(balance.paid)}</dd>
                    </div>
                  </dl>
                  <p className="font-semibold">
                    Saldo a receber: {formatCurrency(balance.balance)}
                  </p>
                  {title && (
                    <p className="text-sm">
                      Cobrança {title.id} · Vencimento {title.dueDate} ·{" "}
                      {title.status === "pago" ? "Quitada" : "Em aberto"}
                    </p>
                  )}
                  {balance.balance > 0 && allowedReceive && (
                    <Button disabled={pending} onClick={() => setPayment(true)}>
                      Receber valor parcial ou total
                    </Button>
                  )}
                </section>
              )}
              {["overview", "checkout"].includes(intent) &&
                !readOnly && active &&
                can("hospitality.checkout") && (
                  <section className="space-y-3 rounded-lg border p-4">
                    <h3 className="font-semibold">Encerrar hospedagem</h3>
                    {balance.balance > 0 ? (
                      <>
                        {corporatePayer && can("hospitality.companyCredit") ? (
                          <>
                            <p className="text-sm">
                              Saída a prazo exige empresa ativa como pagadora.
                              Será criada uma cobrança pelo saldo, sem registrar
                              recebimento.
                            </p>
                            <Label>
                              Vencimento
                              <Input
                                type="date"
                                min={businessDay()}
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                              />
                            </Label>
                            <label className="flex min-h-11 items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={confirmed}
                                onChange={(e) => setConfirmed(e.target.checked)}
                              />
                              Confirmo a saída e a cobrança da empresa
                            </label>
                            <Button
                              disabled={pending || !confirmed || !dueDate}
                              onClick={() =>
                                perform("stay-checkout", { dueDate, confirmed })
                              }
                            >
                              Encerrar com cobrança empresarial
                            </Button>
                          </>
                        ) : (
                          <p className="text-sm">
                            Quite o saldo antes da saída. Saída empresarial a
                            prazo exige autorização do supervisor.
                          </p>
                        )}
                      </>
                    ) : (
                      <Button
                        disabled={pending}
                        onClick={() => perform("stay-checkout", {})}
                      >
                        Confirmar check-out quitado
                      </Button>
                    )}
                  </section>
                )}
              {message && (
                <p role="status" className="text-sm font-medium">
                  {message}
                </p>
              )}
              {intent === "overview" && (
                <section className="space-y-2">
                  <h3 className="font-semibold">Diárias acordadas</h3>
                  {stay.nightlyPrices?.length ? (
                    <ul className="space-y-1 text-sm">
                      {stay.nightlyPrices.map((n) => (
                        <li
                          key={n.date}
                          className="flex flex-wrap justify-between gap-2"
                        >
                          <span>
                            {n.date} · {n.guests} pessoa(s) · {n.tariffName}
                          </span>
                          <span>{formatCurrency(n.total)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Composição das diárias não
                      registrada.
                    </p>
                  )}
                </section>
              )}
              {intent === "overview" && (
                <section className="space-y-2">
                  <h3 className="font-semibold">Consumo preservado</h3>
                  {!stay.charges.length && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum item lançado.
                    </p>
                  )}
                  {stay.charges.map((c) => (
                    <div key={c.id} className="rounded border p-2 text-sm">
                      <p>
                        {c.quantity} × {c.label} ·{" "}
                        {formatCurrency(
                          c.lineTotal ?? c.unitPrice * c.quantity,
                        )}
                        {c.status === "corrected"
                          ? " · Correção de cobrança"
                          : ""}
                      </p>
                      {c.reason && (
                        <p className="text-muted-foreground">{c.reason}</p>
                      )}
                    </div>
                  ))}
                </section>
              )}
              {intent === "overview" && !!stay.adjustments?.length && (
                <section className="space-y-2">
                  <h3 className="font-semibold">Ajustes das diárias</h3>
                  <p className="text-xs text-muted-foreground">
                    Já incluídos no valor líquido das diárias; não são somados
                    novamente.
                  </p>
                  {stay.adjustments.map((a) => (
                    <p key={a.id} className="text-sm">
                      {a.reason} · {formatCurrency(a.value)}
                    </p>
                  ))}
                </section>
              )}
              {intent === "overview" && (
                <section className="space-y-2">
                  <h3 className="font-semibold">
                    Recebimentos e crédito aplicado
                  </h3>
                  {stay.payments.length ? (
                    stay.payments.map((p) => (
                      <p key={p.id} className="text-sm">
                        {p.createdAt.slice(0, 10)} · {p.method} ·{" "}
                        {formatCurrency(p.value)} ·{" "}
                        {p.bucket === "lodging" ? "diárias" : "consumo"}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum recebimento.
                    </p>
                  )}
                </section>
              )}
              {["overview", "occupants"].includes(intent) && (
                <section className="space-y-3">
                  <h3 className="font-semibold">Ocupantes</h3>
                  {occupants.map((o, i) => (
                    <div
                      key={i}
                      className="grid gap-2 rounded border p-3 sm:grid-cols-2"
                    >
                      <Label>
                        Nome do ocupante {i + 1}
                        <Input
                          value={o.name}
                          disabled={
                            readOnly || !active ||
                            !can("hospitality.occupants") ||
                            !!o.customerId
                          }
                          onChange={(e) =>
                            setOccupants((v) =>
                              v.map((p, j) =>
                                i === j ? { ...p, name: e.target.value } : p,
                              ),
                            )
                          }
                        />
                      </Label>
                      <Label>
                        Pessoa cadastrada (opcional)
                        <select
                          aria-label={`Pessoa cadastrada ${i + 1}`}
                          className="mt-1 min-h-11 w-full rounded border bg-background px-2"
                          value={o.customerId}
                          disabled={readOnly || !active || !can("hospitality.occupants")}
                          onChange={(e) =>
                            setOccupants((v) =>
                              v.map((p, j) =>
                                i === j
                                  ? {
                                      name:
                                        customers.find(
                                          (c) => c.id === e.target.value,
                                        )?.name ?? p.name,
                                      customerId: e.target.value,
                                    }
                                  : p,
                              ),
                            )
                          }
                        >
                          <option value="">Informar apenas nome</option>
                          {customers
                            .filter(
                              (c) =>
                                c.active &&
                                c.cpfCnpj.replace(/\D/g, "").length === 11,
                            )
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </Label>
                    </div>
                  ))}
                  {!readOnly && active &&
                    can("hospitality.occupants") &&
                    stay.guestCount && (
                      <Button
                        variant="outline"
                        disabled={
                          pending || occupants.some((o) => !o.name.trim())
                        }
                        onClick={() =>
                          perform("stay-occupants", {
                            occupants: occupants.map((o) => ({
                              ...o,
                              customerId: o.customerId || undefined,
                            })),
                          })
                        }
                      >
                        Salvar ocupantes
                      </Button>
                    )}
                  {!stay.guestCount && (
                    <p className="text-sm text-muted-foreground">
                      Quantidade de hóspedes não informada.
                    </p>
                  )}
                </section>
              )}
              {intent === "overview" && (
                <section className="space-y-2">
                  <h3 className="font-semibold">Histórico de quartos</h3>
                  {stay.allocations.map((a) => (
                    <p key={a.id} className="text-sm">
                      Quarto{" "}
                      {rooms.find((r) => r.id === a.roomId)?.number ?? a.roomId}{" "}
                      · {a.start} a {a.end}
                      {a.reason ? ` · ${a.reason}` : ""}
                    </p>
                  ))}
                </section>
              )}
              {["overview", "transfer"].includes(intent) &&
                !readOnly && active &&
                can("hospitality.transfer") && (
                  <details
                    open={intent === "transfer" ? true : undefined}
                    className="rounded-lg border p-4"
                  >
                    <summary className="min-h-11 cursor-pointer font-semibold">
                      Trocar de quarto
                    </summary>
                    <div className="mt-3 space-y-3">
                      <Label>
                        Destino
                        <select
                          aria-label="Quarto de destino"
                          className="mt-1 min-h-11 w-full rounded border bg-background px-2"
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                        >
                          <option value="">Selecione</option>
                          {rooms
                            .filter(
                              (r) =>
                                r.id !== stay.roomId &&
                                r.status === "disponivel" &&
                                !!stay.guestCount &&
                                !!r.capacity &&
                                r.capacity >= stay.guestCount &&
                                !reservations.some(
                                  (booking) =>
                                    booking.id !== stay.reservationId &&
                                    booking.roomId === r.id &&
                                    ["confirmada", "checkin"].includes(
                                      booking.status,
                                    ) &&
                                    booking.checkIn < stay.checkOut &&
                                    booking.checkOut > businessDay(),
                                ),
                            )
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.number} · Capacidade{" "}
                                {r.capacity ?? "não configurada"}
                              </option>
                            ))}
                        </select>
                      </Label>
                      <Label>
                        Motivo
                        <Input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </Label>
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={reprice}
                          onChange={(e) => setReprice(e.target.checked)}
                        />
                        Recalcular somente as diárias a partir de hoje
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Sem essa opção, o valor acordado é preservado. A troca
                        mantém a mesma conta; o quarto anterior vai para
                        limpeza.
                      </p>
                      {reprice && destination && (
                        <LodgingQuotePreview
                          result={previewLodging(
                            rooms.find((r) => r.id === Number(destination)),
                            lodgingTariffs,
                            stay.guestCount ?? 0,
                            businessDay(),
                            stay.checkOut,
                          )}
                        />
                      )}
                      <Button
                        disabled={
                          pending || !destination || reason.trim().length < 5
                        }
                        onClick={() =>
                          perform("stay-transfer", {
                            roomId: Number(destination),
                            effectiveDate: businessDay(),
                            reason,
                            reprice,
                          })
                        }
                      >
                        Confirmar troca de quarto
                      </Button>
                    </div>
                  </details>
                )}

              {["overview", "extend"].includes(intent) &&
                !readOnly && active &&
                can("hospitality.extend") && (
                  <section
                    className="space-y-3 rounded-lg border p-4"
                    aria-label="Prorrogação da estadia"
                  >
                    <h3 className="font-semibold">Prorrogar estadia</h3>
                    {intent === "overview" ? (
                      <Button
                        variant="outline"
                        onClick={() => changeIntent("extend")}
                      >
                        Revisar prorrogação
                      </Button>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Saída atual: {stay.checkOut}. Somente as noites
                          adicionais usam a tarifa vigente; diárias anteriores,
                          descontos e pagamentos são preservados.
                        </p>
                        <Label htmlFor="extend-checkout">Nova saída</Label>
                        <Input
                          id="extend-checkout"
                          type="date"
                          min={new Date(
                            Date.parse(
                              stay.checkOut > businessDay()
                                ? stay.checkOut
                                : businessDay(),
                            ) + 86400000,
                          )
                            .toISOString()
                            .slice(0, 10)}
                          value={extendOut}
                          onChange={(e) => {
                            setExtendOut(e.target.value);
                            setExtensionConfirmed(false);
                          }}
                        />
                        {extendOut && (
                          <LodgingQuotePreview result={extraPreview} />
                        )}
                        {extensionError && (
                          <p role="alert" className="text-sm text-destructive">
                            {extensionError}
                          </p>
                        )}
                        {extraCollision && (
                          <p role="alert" className="text-sm text-destructive">
                            Há outra reserva no período adicional. Escolha outra
                            saída ou revise a troca de quarto.
                          </p>
                        )}
                        {!stay.guestCount || !stay.nightlyPrices?.length ? (
                          <p role="alert">
                            Regularize a ocupação e as diárias antes de
                            prorrogar.
                          </p>
                        ) : null}
                        <Label htmlFor="extend-reason">Motivo</Label>
                        <Input
                          id="extend-reason"
                          value={extendReason}
                          onChange={(e) => {
                            setExtendReason(e.target.value);
                            setExtensionConfirmed(false);
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Preço e disponibilidade serão verificados novamente ao
                          confirmar. A prorrogação altera a cobrança, sem
                          registrar pagamento.
                        </p>
                        <label className="flex min-h-11 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={extensionConfirmed}
                            onChange={(e) =>
                              setExtensionConfirmed(e.target.checked)
                            }
                          />
                          Confirmo a nova saída e as diárias adicionais
                        </label>
                        <Button
                          disabled={
                            pending ||
                            !extensionConfirmed ||
                            !!extensionError ||
                            extraCollision ||
                            !extraPreview.quote ||
                            extendReason.trim().length < 5 ||
                            !stay.guestCount ||
                            !stay.nightlyPrices?.length
                          }
                          onClick={() => {
                            if (extraPreview.quote)
                              void perform("stay-extend", {
                                checkOut: extendOut,
                                reason: extendReason,
                                quotedTotal: extraPreview.quote.total,
                                quoteSignature: extensionQuoteSignature(
                                  extraPreview.quote,
                                ),
                                confirmed: true,
                              });
                          }}
                        >
                          Confirmar prorrogação
                        </Button>
                      </>
                    )}
                  </section>
                )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => requestExit(onClose)}
              >
                {readOnly ? "Fechar consulta" : "Fechar atendimento"}
              </Button>
            </fieldset>
          ) : (
            <p role="status" className="p-4">
              Você não tem permissão para este atendimento.
            </p>
          )}
        </SheetContent>
      </Sheet>
      <PaymentDialog
        key={stay.id}
        mixedEnabled={getDataConfig().adapter === "database"}
        open={payment && permitted && allowedReceive && balance.balance > 0}
        onClose={closePayment}
        title="Receber hospedagem"
        maximum={balance.balance}
        allowCredit={active && stay.payerId === stay.occupants[0]?.customerId}
        onConfirm={async (paymentMethod, accountId, value, payments) => {
          if (pendingRef.current)
            throw Error("Aguarde a operação em andamento.");
          pendingRef.current = true;
          setPending(true);
          try {
            const result = await runOperation<{ stay?: Stay }>("stay-receive", {
              ...target,
              paymentMethod,
              accountId,
              value,
              payments,
            });
            if (result.stay) {
              setStay(result.stay);
              setMessage(
                stayBalance(result.stay).balance === 0
                  ? "Pagamento registrado. Confirme o check-out para concluir a saída."
                  : "Pagamento registrado. O saldo restante continua em aberto.",
              );
            } else onClose();
          } finally {
            pendingRef.current = false;
            setPending(false);
          }
        }}
      />
      <Dialog
        open={!!exit}
        onOpenChange={(open) => {
          if (!open && !pending) setExit(null);
        }}
      >
        <DialogContent busy={pending}>
          <DialogHeader>
            <DialogTitle>Há alterações não salvas</DialogTitle>
            <DialogDescription>
              Você pode permanecer no atendimento ou descartar a edição antes de
              sair.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExit(null)}>
              Permanecer
            </Button>
            <Button
              onClick={() => {
                const proceed = exit;
                resetDraft();
                setExit(null);
                proceed?.();
              }}
            >
              Descartar e sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
