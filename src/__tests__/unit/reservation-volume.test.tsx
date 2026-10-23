import { expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ReservationsTab } from "@/components/reservations-tab"
import type { Reservation } from "@/lib/store"
const app = vi.hoisted(() => ({ reservations: [] as Reservation[], rooms: [], customers: [], systemSettings: {checkInTime:"14:00"} }))
vi.mock("@/lib/app-context", () => ({useApp:()=>app}))
vi.mock("@/lib/auth-context", () => ({useAuth:()=>({can:()=>true})}))
vi.mock("@/components/booking-form",()=>({BookingForm:()=>null}))
vi.mock("@/components/checkin-modal",()=>({CheckinModal:()=>null}))
vi.mock("@/components/reservation-payment-button",()=>({ReservationPaymentButton:()=>null}))
it("opera a lista com duzentas reservas", () => {
 app.reservations = Array.from({length:200},(_,i)=>({id:`r${i}`,roomId:i,roomNumber:String(100+i),guestName:`Hóspede ${i}`,cpf:"",checkIn:"2099-01-02",checkOut:"2099-01-03",status:"confirmada",totalValue:100}))
 const started=performance.now()
 render(<ReservationsTab />)
 console.log(`render-200-ms=${Math.round(performance.now()-started)}`)
 expect(screen.getAllByRole("row")).toHaveLength(26)
 fireEvent.change(screen.getByLabelText("Buscar reserva"),{target:{value:"r199"}})
 expect(screen.getAllByRole("row")).toHaveLength(2)
 fireEvent.click(screen.getByRole("button",{name:"Hóspede 199"}))
 expect(screen.getByRole("dialog")).toHaveTextContent("Hóspede 199")
})
