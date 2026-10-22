import type { Stay } from "@/lib/stays"
import type { Reservation } from "@/lib/store"
import { businessDay } from "@/lib/utils/business-values"
import { calendarDays, nextDay, spreadCents, cents, money, type ReportQuery, type ManagementReport, type ReportLine } from "./management"

export type LodgingReportStay = Pick<Stay, "id" | "reservationId" | "guestName" | "payerId" | "roomId" | "checkIn" | "checkOut" | "status" | "lodgingValue" | "nightlyPrices" | "endedAt" | "recordedAt" | "arrivalReason" | "allocations">
const calendar = (value: string) => value.split("T")[0]
const metric = (key: string, label: string, value: number, unit: "money" | "number" | "percent" = "money") => ({key,label,value,unit})
const inside = (day: string, q: ReportQuery) => day >= q.start && day <= q.end
const addLine = (report: ManagementReport, line: ReportLine) => { report.rows.push(line) }

/** Same nightly recognition, occupancy and ADR for database and browser examples. */
export function buildLodgingReport(q: ReportQuery, now: Date, input: LodgingReportStay[], rooms: number, bookings: Pick<Reservation, "id" | "checkIn" | "checkOut">[], missing = 0): ManagementReport {
  const out: ManagementReport = { ...q, asOf: now.toISOString(), criteria: [], warnings: [], metrics: [], rows: [] }
  const today = businessDay(now), occupied = new Set<string>()
  const stays = input.filter(s => ["active", "closed"].includes(s.status) && s.checkIn <= q.end && s.checkOut > q.start)
  const periods = new Map(bookings.map(r => [r.id, r]))
  let agreed = 0,
    provided = 0;
  for (const stay of stays) {
    const days = calendarDays(calendar(stay.checkIn), calendar(stay.checkOut));
    const original = Array.isArray(stay.nightlyPrices)
      ? (stay.nightlyPrices as unknown as { date: string; total: number }[])
      : [];
    const valid =
      original.length === days.length &&
      original.every(
        (n) =>
          days.includes(n.date) && Number.isFinite(n.total) && n.total >= 0,
      ) &&
      new Set(original.map((n) => n.date)).size === days.length &&
      original.reduce((s, n) => s + cents(n.total), 0) ===
        cents(stay.lodgingValue);
    const nights = valid
      ? original.map((n) => ({ date: n.date, value: cents(n.total) }))
      : spreadCents(cents(stay.lodgingValue), days);
    if (!valid)
      out.warnings.push(
        `Hospedagem ${stay.id}: valor por noite estimado pelo rateio do total acordado.`,
      );
    const end = stay.endedAt
      ? [calendar(stay.checkOut), businessDay(stay.endedAt)].sort()[0]
      : calendar(stay.checkOut);
    for (const night of nights) {
      if (!inside(night.date, q)) continue;
      agreed += night.value;
      const allocation = stay.allocations.find(
        (a) => calendar(a.start) <= night.date && calendar(a.end) > night.date,
      );
      const providedNight = night.date < today && night.date < end;
      addLine(out, {
        id: `${stay.id}:${night.date}`,
        date: night.date,
        kind: providedNight ? "diaria-prestada" : "diaria-acordada",
        label: stay.guestName,
        value: money(night.value),
        quantity: 1,
        estimated: !valid,
        source: { collection: "stays", id: stay.id },
        details: {
          roomId: allocation?.roomId ?? stay.roomId,
          payerId: stay.payerId ?? "",
          reservationId: stay.reservationId,
          plannedArrival: periods.has(stay.reservationId) ? calendar(periods.get(stay.reservationId)!.checkIn) : "",
          plannedDeparture: periods.has(stay.reservationId) ? calendar(periods.get(stay.reservationId)!.checkOut) : "",
          actualDeparture: stay.endedAt ? businessDay(stay.endedAt) : "",
          actualArrival: calendar(stay.checkIn),
          recordedAt: stay.recordedAt ?? "",
          arrivalReason: stay.arrivalReason ?? "",
        },
      });
      if (providedNight) {
        provided += night.value;
        const key = `${allocation?.roomId ?? stay.roomId}:${night.date}`;
        if (occupied.has(key))
          out.warnings.push(`Ocupação duplicada no quarto/noite ${key}.`);
        occupied.add(key);
      }
    }
  }
  if (missing)
    out.warnings.push(
      `${missing} reservas atendidas sem hospedagem estruturada; valores não incluídos.`,
    );
  const elapsed = calendarDays(q.start, nextDay(q.end)).filter(
      (d) => d < today,
    ).length,
    capacity = rooms * elapsed;
  out.metrics = [
    metric("lodgingAgreed", "Diárias acordadas no período", money(agreed)),
    metric("lodgingProvided", "Diárias prestadas", money(provided)),
    metric("roomNights", "Noites-quarto ocupadas", occupied.size, "number"),
    metric("capacityNights", "Noites-quarto do catálogo", capacity, "number"),
    metric(
      "occupancy",
      "Ocupação do catálogo",
      capacity ? Math.round((occupied.size / capacity) * 10000) / 100 : 0,
      "percent",
    ),
    metric(
      "adr",
      "Diária média por noite-quarto prestada",
      occupied.size ? money(Math.round(provided / occupied.size)) : 0,
    ),
  ];
  out.criteria = [
    "Entrada inclusiva, saída exclusiva. Noite prestada somente após a virada do dia em America/Sao_Paulo; saída efetiva limita as noites prestadas.",
    "Ocupação usa quartos do catálogo atual × dias encerrados do período; bloqueios históricos não têm série completa e não são deduzidos.",
    "Reservas futuras, sinais e recebimentos de dívidas não elevam diárias prestadas. Valores acordados não são receitas recebidas.",
    "Uma transferência de quarto conserva a diária e usa a alocação da noite.",
  ];
  return out;
}