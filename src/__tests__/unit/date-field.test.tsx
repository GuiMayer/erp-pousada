import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DateField } from "@/components/ui/date-field"
import { calendarDayDisplay, calendarDayFromDisplay, calendarDayISO, parseCalendarDay } from "@/lib/utils/calendar-date"

describe("Datas comerciais em português", () => {
  it("preserva o dia em viradas de mês e rejeita dias inexistentes", () => {
    for (const iso of ["2024-02-29", "2026-10-31", "2026-11-01", "2027-01-01"]) {
      expect(calendarDayISO(parseCalendarDay(iso)!)).toBe(iso)
      expect(calendarDayFromDisplay(calendarDayDisplay(iso))).toBe(iso)
    }
    expect(calendarDayFromDisplay("29/02/2026")).toBeUndefined()
    expect(calendarDayFromDisplay("31/04/2026")).toBeUndefined()
    expect(calendarDayFromDisplay("10/22/2026")).toBeUndefined()
  })
  it("exibe dd/mm/aaaa e transmite ISO sem depender do idioma do navegador", () => {
    function Example() { const [value, change] = useState("2026-10-31"); return <><DateField aria-label="Chegada" value={value} onValueChange={change} /><output>{value}</output></> }
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US")
    render(<Example />)
    const input = screen.getByRole("textbox", {name:"Chegada"})
    expect(input).toHaveValue("31/10/2026")
    fireEvent.change(input,{target:{value:"01/11/2026"}})
    expect(screen.getByRole("status")).toHaveTextContent("2026-11-01")
    expect(input).toHaveValue("01/11/2026")
    fireEvent.change(input,{target:{value:""}})
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
    vi.restoreAllMocks()
  })
  it("bloqueia datas inválidas e fora do intervalo na validação do formulário", () => {
    const change = vi.fn()
    render(<DateField aria-label="Fim" value="2026-10-31" min="2026-10-01" onValueChange={change} required />)
    const input = screen.getByRole("textbox", {name:"Fim"})
    fireEvent.change(input,{target:{value:"30/09/2026"}})
    expect(input).toBeInvalid()
    expect(change).not.toHaveBeenCalled()
    fireEvent.change(input,{target:{value:"31/10/2026"}})
    expect(input).toBeValid()
    expect(change).toHaveBeenCalledWith("2026-10-31")
  })
})
