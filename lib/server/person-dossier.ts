import { z } from "zod"
import { prisma } from "@/lib/db/client"
import type { Actor } from "./auth"
import { can, demand } from "./permissions"
import { HttpError } from "./http"
import { getCollectionMapper } from "./db/mappers"
export const dossierQuery = z.object({ id:z.string().min(1).max(200), page:z.coerce.number().int().min(1).max(1000).default(1), section:z.enum(["stays","titles","receipts"]).default("stays") })
export async function personDossier(actor: Actor, input: unknown) {
  const q=dossierQuery.parse(input); demand(actor,"customers.read")
  return prisma.$transaction(async tx=>{
    const person=await tx.customer.findUnique({where:{id:q.id},select:{id:true,name:true}})
    if(!person) throw new HttpError(404,"Pessoa não encontrada")
    const access={stays:can(actor,"stays.read"),titles:can(actor,"accountsReceivable.read"),receipts:can(actor,"transactions.read")&&can(actor,"accountsReceivable.read"),credit:can(actor,"guests.read")}
    const titles=access.titles ? await tx.accountReceivable.aggregate({where:{customerId:q.id,status:{not:"cancelado"}},_sum:{value:true,paidValue:true},_count:true}) : null
    const credit=access.credit ? await tx.guestProfile.findFirst({where:{customerId:q.id},select:{creditValue:true}}) : null
    const whereStay={OR:[{payerId:q.id},{occupants:{some:{customerId:q.id}}}]}
    let rows: unknown[]=[], total=0
    if(access[q.section]) {
      const skip=(q.page-1)*20
      if(q.section==="stays") {
        const records=await tx.stay.findMany({where:whereStay,include:{occupants:true,allocations:true,charges:true,payments:true,adjustments:true},orderBy:[{checkIn:"desc"},{id:"asc"}],skip,take:20})
        rows=records.map(r=>getCollectionMapper("stays")!.toApp(r));total=await tx.stay.count({where:whereStay})
      } else if(q.section==="titles") {
        rows=await tx.accountReceivable.findMany({where:{customerId:q.id},include:{installments:true},orderBy:[{dueDate:"desc"},{id:"asc"}],skip,take:20});total=await tx.accountReceivable.count({where:{customerId:q.id}})
      } else {
        const ids=await tx.accountReceivable.findMany({where:{customerId:q.id},select:{id:true},take:50001})
        if(ids.length>50000)throw new HttpError(413,"Histórico muito extenso; consulte por origem")
        const parts=await tx.accountReceivableInstallment.findMany({where:{accountReceivable:{customerId:q.id}},select:{id:true},take:50001})
        if(parts.length>50000)throw new HttpError(413,"Histórico de parcelas muito extenso")
        const reservations=await tx.reservation.findMany({where:{payerId:q.id},select:{id:true},take:50001})
        if(reservations.length>50000)throw new HttpError(413,"Histórico de reservas muito extenso")
        const whereReceipt={OR:[{allocations:{some:{targetType:"receivable",targetId:{in:ids.map(r=>r.id)}}}},{allocations:{some:{targetType:"receivable-installment",targetId:{in:parts.map(r=>r.id)}}}},{stayPayments:{some:{stay:{payerId:q.id}}}},{originType:"reservation",originId:{in:reservations.map(r=>r.id)}}]}
        const scope={OR:[whereReceipt,{reversalOf:whereReceipt}]}
        rows=await tx.transaction.findMany({where:scope,select:{id:true,date:true,description:true,value:true,type:true,paymentMethod:true,originType:true,originId:true,reversalOfId:true,allocations:true},orderBy:[{date:"desc"},{id:"asc"}],skip,take:20});total=await tx.transaction.count({where:scope})
      }
    }
    return {person,access,summary:titles?{titles:titles._count,pending:Math.max(0,Number(titles._sum.value??0)-Number(titles._sum.paidValue??0)),settled:Number(titles._sum.paidValue??0)}:null,credit:access.credit?Number(credit?.creditValue??0):null,rows,page:q.page,total,section:q.section}
  },{isolationLevel:"RepeatableRead",timeout:30000})
}
