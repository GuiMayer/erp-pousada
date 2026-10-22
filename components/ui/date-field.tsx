"use client"
import { useEffect, useRef, useState, type ComponentProps } from "react"
import { CalendarIcon } from "lucide-react"
import { ptBR } from "date-fns/locale"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Button } from "./button"
import { Input } from "./input"
import { cn } from "@/lib/utils"
import { calendarDayDisplay, calendarDayFromDisplay, calendarDayISO, parseCalendarDay } from "@/lib/utils/calendar-date"

type Props = Omit<ComponentProps<"input">, "type" | "value" | "onChange" | "onInput" | "min" | "max"> & {
  value: string; onValueChange: (iso: string) => void; min?: string; max?: string;
}
export function DateField({ value, onValueChange, min, max, className, disabled, ...props }: Props) {
  const [draft, setDraft] = useState(calendarDayDisplay(value))
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const parsed = calendarDayFromDisplay(draft)
  const invalid = parsed === undefined || !!parsed && (!!min && parsed < min || !!max && parsed > max)
  useEffect(() => { setDraft(calendarDayDisplay(value)) }, [value])
  useEffect(() => { input.current?.setCustomValidity(invalid ? "Informe uma data válida no formato dd/mm/aaaa e dentro do período permitido." : "") }, [invalid])
  return <div className={cn("flex min-w-0 items-stretch", className)}>
    <Input {...props} ref={input} type="text" lang="pt-BR" disabled={disabled} placeholder="dd/mm/aaaa" value={draft} aria-invalid={invalid || undefined} className="min-h-11 rounded-r-none" onChange={event => {
      const next = event.target.value
      setDraft(next)
      const iso = calendarDayFromDisplay(next)
      if (iso !== undefined && (!iso || (!min || iso >= min) && (!max || iso <= max))) onValueChange(iso)
    }} />
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" disabled={disabled || props.readOnly} className="min-h-11 shrink-0 rounded-l-none border-l-0 px-3" aria-label={`Abrir calendário${props["aria-label"] ? `: ${props["aria-label"]}` : ""}`}><CalendarIcon className="size-4" /></Button></PopoverTrigger><PopoverContent align="start" className="w-auto p-0">
      <Calendar mode="single" locale={ptBR} weekStartsOn={0} selected={parseCalendarDay(value)} defaultMonth={parseCalendarDay(value)} disabled={date => !!min && calendarDayISO(date) < min || !!max && calendarDayISO(date) > max} onSelect={date => {
        if (date) { const iso = calendarDayISO(date); setDraft(calendarDayDisplay(iso)); onValueChange(iso); setOpen(false); input.current?.focus() }
      }} />
      {!props.required && <Button type="button" variant="ghost" className="m-2" onClick={() => {setDraft(""); onValueChange(""); setOpen(false)}}>Limpar data</Button>}
    </PopoverContent></Popover>
  </div>
}
