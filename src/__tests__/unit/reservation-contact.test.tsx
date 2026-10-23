import { beforeEach, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { whatsappContact, reservationPerson } from "@/lib/reservation-contact"
import { ReservationContact } from "@/components/reservation-contact"
import type { Customer, Reservation } from "@/lib/store"
const state = vi.hoisted(() => ({canRead:true, customers:[] as Customer[], guests:[]}))
vi.mock("@/lib/app-context",()=>({useApp:()=>state}))
vi.mock("@/lib/auth-context",()=>({useAuth:()=>({can:()=>state.canRead})}))
const reservation = {cpf:"529.982.247-25",payerId:"company"} as Reservation
const person = {id:"person",cpfCnpj:"52998224725",name:"Pessoa",phone:"+1 202 555 0123"} as Customer
beforeEach(()=>{state.canRead=true;state.customers=[person,{id:"company",cpfCnpj:"11222333000181",name:"Empresa",phone:"+1 202 555 0150"} as Customer]})

it("normaliza Brasil com DDD e internacional explícito sem extrair números de texto", () => {
 expect(whatsappContact("(47) 99123-4567")).toMatchObject({number:"+5547991234567",href:"https://wa.me/5547991234567",ddi:"+55"})
 expect(whatsappContact("5547991234567")?.number).toBe("+5547991234567")
 expect(whatsappContact("+1 202 555 0123")?.number).toBe("+12025550123")
 for(const invalid of [undefined,"","1234","202 555 0123","+999 123456789","WhatsApp: 47991234567","+12025550123 ramal 12","javascript:47991234567"]) expect(whatsappContact(invalid)).toBeNull()
})
it("identifica o hóspede pelo documento, sem usar o telefone da empresa pagadora", () => {
 expect(reservationPerson(reservation,state.customers)?.id).toBe("person")
 expect(reservationPerson({...reservation,cpf:""},state.customers)).toBeUndefined()
 state.customers=[state.customers[1]]
 render(<ReservationContact reservation={reservation} />)
 expect(screen.getByText("Telefone não informado.")).toBeInTheDocument()
 expect(screen.queryByRole("link")).not.toBeInTheDocument()
})
it("oferece link explícito sem mensagem e permite copiar o mesmo telefone",async()=>{
 const writeText=vi.fn().mockResolvedValue(undefined)
 Object.defineProperty(navigator,"clipboard",{value:{writeText},configurable:true})
 render(<ReservationContact reservation={reservation} />)
 const link=screen.getByRole("link",{name:/Abrir WhatsApp de Pessoa/})
 expect(link).toHaveAttribute("href","https://wa.me/12025550123")
 expect(link).toHaveAttribute("rel","noopener noreferrer")
 expect(writeText).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole("button",{name:"Copiar telefone"}))
 await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("Telefone copiado"))
 expect(writeText).toHaveBeenCalledWith(person.phone)
})
it("usa o segundo número válido e não expõe contato sem permissão",()=>{
 state.customers=[{...person,phone:"incompleto",phone2:"+1 202 555 0170"}]
 const view=render(<ReservationContact reservation={reservation} />)
 expect(screen.getByRole("link")).toHaveAttribute("href","https://wa.me/12025550170")
 state.canRead=false;view.rerender(<ReservationContact reservation={reservation} />)
 expect(screen.queryByRole("link")).not.toBeInTheDocument()
 expect(screen.queryByText(/0170/)).not.toBeInTheDocument()
})
