import { performance } from "node:perf_hooks"
import { pendingReservationGroups } from "../lib/reservation-groups"
import { reservationWorklist, emptyReservationFilters } from "../lib/reservation-worklist"
import type { Reservation } from "../lib/store"

// Synthetic, read-only benchmark. Does not open a database or run the application.
const records: Reservation[] = Array.from({length:200}, (_, i) => ({
  id:`RES-${String(i).padStart(4,"0")}`,guestName:`Hóspede de exemplo com nome longo número ${i}`,
  cpf:"",roomId:i+1,roomNumber:String(i+100),checkIn:"2026-10-22",checkOut:"2026-10-24",status:"confirmada",totalValue:200,
}))
const current = (query="") => reservationWorklist(records, [], {...emptyReservationFilters,query},"2026-10-22")
function measure(run: () => unknown) {
  for(let i=0;i<10;i++) run()
  const samples=Array.from({length:100},()=>{const start=performance.now();run();return performance.now()-start}).sort((a,b)=>a-b)
  return {medianMs:Number(samples[50].toFixed(3)),p95Ms:Number(samples[95].toFixed(3))}
}
const original=pendingReservationGroups(records), paged=current(), searched=current("RES-0199")
if(original.length!==200 || paged.groups.length!==25 || searched.groups[0]?.pending[0].id!=="RES-0199") throw Error("A consulta perdeu a identidade ou o limite de resultados")
console.log(JSON.stringify({
  dataset:"200 reservas fictícias, nomes longos, sem banco", originalRows:original.length, rowsPerPage:paged.groups.length,
  foundByReference:searched.matchingCount,
  selectorTiming:{originalAll:measure(()=>pendingReservationGroups(records)),pagedAll:measure(()=>current()),referenceSearch:measure(()=>current("RES-0199"))},
  limits:"Tempos do seletor neste computador. Não medem renderização, rede, cliques ou velocidade do operador. Não há meta temporal fixa de CI.",
},null,2))
