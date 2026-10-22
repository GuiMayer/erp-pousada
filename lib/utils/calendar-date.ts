/** Business dates are calendar days, never UTC instants. */
export function parseCalendarDay(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day, 12)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined
}
export function calendarDayISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
export function calendarDayDisplay(value: string): string {
  return parseCalendarDay(value) ? value.split("-").reverse().join("/") : ""
}
export function calendarDayFromDisplay(value: string): string | undefined {
  if (value === "") return ""
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return undefined
  const iso = value.split("/").reverse().join("-")
  return parseCalendarDay(iso) ? iso : undefined
}
