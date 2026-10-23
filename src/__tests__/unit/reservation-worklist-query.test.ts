import { expect, it } from "vitest"
import { reservationWorklist, emptyReservationFilters as empty } from "@/lib/reservation-worklist"
import type { Reservation } from "@/lib/store"
const booking = (id: string, extra: Partial<Reservation> = {}): Reservation => ({id,guestName:"João Souza",cpf:"",roomId:1,roomNumber:"101",checkIn:"2026-10-22",checkOut:"2026-10-24",status:"confirmada",totalValue:100,...extra})
const people = [{id:"company",name:"Empresa Água Azul"}]
const query = (records:Reservation[], patch = {}, page=1) => reservationWorklist(records,people,{...empty,...patch},"2026-10-22",page)

it("combina busca sem acentos por empresa/quarto/referência e preserva o contexto do grupo", () => {
 const records=[booking("a",{groupId:"g",payerId:"company"}),booking("b",{groupId:"g",roomNumber:"102",checkIn:"2026-10-25"}),booking("c",{status:"checkin"})]
 const result=query(records,{query:"agua 101",arrival:"today"})
 expect(result.matchingCount).toBe(1)
 expect(result.groups).toHaveLength(1)
 expect(result.groups[0]).toMatchObject({roomNumbers:"101, 102",matchingIds:["a"],outsideCount:1})
 expect(result.groups[0].members.map(r=>r.id)).toEqual(["a","b"])
 expect(query(records,{query:"g"}).groups).toHaveLength(1)
 expect(query(records,{query:"JOAO"}).matchingCount).toBe(2)
})
it("delimita hoje, próximos sete dias e atrasadas sem trazer o Histórico", () => {
 const records=[booking("late",{checkIn:"2026-10-21"}),booking("today"),booking("next",{checkIn:"2026-10-29"}),booking("after",{checkIn:"2026-10-30"}),booking("cancelled",{status:"cancelada"})]
 expect(query(records,{arrival:"today"}).groups.map(g=>g.pending[0].id)).toEqual(["today"])
 expect(query(records,{arrival:"next"}).groups.map(g=>g.pending[0].id)).toEqual(["next"])
 expect(query(records,{arrival:"late"}).groups.map(g=>g.pending[0].id)).toEqual(["late"])
 expect(query(records,{from:"2026-10-22",until:"2026-10-22"}).matchingCount).toBe(1)
 expect(query(records,{from:"2026-10-25",until:"2026-10-22"})).toMatchObject({invalidPeriod:true,matchingCount:0})
})
it("pagina grupos inteiros com 200 reservas sem repetir ou perder quartos e ajusta página após sincronização", () => {
 const records=Array.from({length:200},(_,i)=>booking(`r${i}`,{groupId:`g${Math.floor(i/2)}`,roomNumber:String(i)}))
 const pages=[1,2,3,4].map(page=>query(records,{},page))
 expect(pages[0]).toMatchObject({pageCount:4,groupCount:100,matchingCount:200})
 const groups=pages.flatMap(p=>p.groups)
 expect(new Set(groups.map(g=>g.key)).size).toBe(100)
 expect(groups.every(g=>g.pending.length===2)).toBe(true)
 expect(query(records,{query:"inexistente"},4)).toMatchObject({page:1,pageCount:1,groups:[]})
 expect(query([records[0]],{},8)).toMatchObject({page:1,pageCount:1})
})
