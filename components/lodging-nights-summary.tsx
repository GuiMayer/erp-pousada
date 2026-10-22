import type { NightlyPrice } from "@/lib/lodging-pricing"
import { groupLodgingNights } from "@/lib/lodging-summary"
import { formatCurrency } from "@/lib/utils/formatters"

const date = (value: string) => value.split("-").reverse().join("-")

export function LodgingNightsSummary({ nights }: { nights: NightlyPrice[] }) {
  return <ul className="space-y-2 text-sm">{groupLodgingNights(nights).map(group => <li key={group.start} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
    <span className="min-w-0 flex-1"><span className="block tabular-nums">{date(group.start)}{group.count > 1 && ` - ${date(group.end)}`}</span><span className="text-muted-foreground">{group.night.guests} pessoa(s) · {group.night.tariffName}</span></span>
    <span className="shrink-0 tabular-nums" title={`Total: ${formatCurrency(group.count * group.night.total)}`} aria-label={`${group.count} ${group.count === 1 ? "diária" : "diárias"} de ${formatCurrency(group.night.total)} cada`}>{group.count} {group.count === 1 ? "diária" : "diárias"} • {formatCurrency(group.night.total)}</span>
  </li>)}</ul>
}
