import { afterEach, describe, expect, it, vi } from "vitest"
import { parseISO } from "date-fns"
import { getWeekDates, getWeekOffset } from "@/components/room-date-strip"

afterEach(() => vi.useRealTimers())

describe("Semanas do mapa de domingo a sábado", () => {
  it.each([18, 22, 24])("começa no domingo mesmo quando hoje é dia %s", day => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`2026-10-${day}T15:00:00Z`))
    expect(getWeekDates(0).map(d => d.date)).toEqual([
      "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24",
    ])
    expect(getWeekDates(-1)[0].date).toBe("2026-10-11")
    expect(getWeekDates(1)[0].date).toBe("2026-10-25")
    expect(getWeekDates(0).find(d => d.isToday)?.date).toBe(`2026-10-${day}`)
  })

  it("encontra a semana do calendário nas viradas de domingo e de ano", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-12-31T15:00:00Z"))
    for (const [date, expected] of [["2026-12-26", -1], ["2026-12-27", 0], ["2027-01-02", 0], ["2027-01-03", 1]] as const) {
      const offset = getWeekOffset(parseISO(date))
      expect(offset).toBe(expected)
      expect(getWeekDates(offset).some(d => d.date === date)).toBe(true)
    }
  })
})
