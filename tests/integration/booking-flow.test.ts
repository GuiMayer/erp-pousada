import { beforeEach, afterAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { executeOperation } from "@/lib/server/operations"
import { buildManagementReport } from "@/lib/server/management-reports"
import { reportCSV } from "@/lib/reports/management"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import { businessDay } from "@/lib/utils/business-values"
import type { Actor } from "@/lib/server/auth"

if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw new Error("Use apenas erp_test")
const day = (offset: number) => { const d = new Date(businessDay() + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10) }
let actor: Actor
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "customers", "rooms", "users", "system_settings", "bank_accounts", "cash_closes" CASCADE')
  const user = await prisma.user.create({ data: { id: "booking-actor", username: "booking-actor", fullName: "Teste", role: "supervisor", password: "test-only", createdBy: "test" } })
  const session = await prisma.authSession.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 600000) } })
  actor = { id: user.id, username: user.username, role: "supervisor", sessionId: session.id, approvedUntil: null, permissions: ALL_PERMISSIONS }
  await prisma.customer.createMany({ data: [
    { id: "person", name: "Pessoa", cpfCnpj: "52998224725", roles: ["guest", "payer"], active: true },
    { id: "company", name: "Empresa", cpfCnpj: "11222333000181", roles: ["payer"], active: true },
  ] })
  await prisma.guestProfile.create({ data: { cpf: "52998224725", customerId: "person", name: "Pessoa", totalStays: 0, avgTicket: 0, noShows: 0 } })
  await prisma.room.create({ data: { id: 1, number: "101", type: "Standard", capacity: 2, status: "disponivel", timeline: [] } })
  await prisma.lodgingTariff.create({ data: { id: "tariff", name: "Padrão", roomType: "Standard", minGuests: 1, maxGuests: 2, pricePerPerson: 100, validFrom: new Date(day(-365)), active: true } })
  await prisma.bankAccount.create({ data: { id: "bank", name: "Conta", bank: "Banco", type: "corrente", initialBalance: 1000, currentBalance: 1000, active: true } })
})
afterAll(() => prisma.$disconnect())
const payload = (start = 0, end = 2) => ({ roomId: 1, cpf: "52998224725", guestName: "Pessoa", guestCount: 1, payerId: "person", checkIn: day(start), checkOut: day(end), totalValue: (end - start) * 100 })
const op = (kind: string, input: unknown, a = actor) => executeOperation(a, randomUUID(), kind, input)
async function reservePaid(value = 100) {
  const reservation = await op("reserve", payload()) as { id: string }
  if (value) await op("pay-reservation", { reservationId: reservation.id, value, paymentMethod: "pix", accountId: "bank" })
  return prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } })
}

describe("Atendimento de reservas, entradas e cancelamentos", () => {
  it.each([[-1,-3],[-1,0],[2,-1]])("saída prevista %s e efetiva %s conservam contrato e consumo do ocupante atual", async (planned, offset) => {
    const value = (planned+5)*100
    const r = await op("reserve", payload(-5,planned)) as {id:string}
    await op("pay-reservation",{reservationId:r.id,value,paymentMethod:"pix",accountId:"bank"})
    const current = await prisma.reservation.findUniqueOrThrow({where:{id:r.id}})
    await prisma.room.update({where:{id:1},data:{status:"ocupado",guest:"Outro hóspede"}})
    await prisma.roomConsumption.create({data:{id:"current-consumption",roomId:1,items:{create:[{id:"current-drink",label:"Bebida atual",unitPrice:15,quantity:1}]}}})
    const entry = {...payload(-5,planned),reservationId:r.id,recordVersion:current.recordVersion,actualCheckOut:day(offset),reason:"Registro esquecido pela recepção"}
    await expect(op("record-completed-stay",entry)).rejects.toMatchObject({status:409})
    await op("record-completed-stay",{...entry,keepAgreedPrice:true})
    const stay = await prisma.stay.findUniqueOrThrow({where:{reservationId:r.id},include:{allocations:true,charges:true}})
    expect(stay.status).toBe("closed")
    expect(stay.checkOut.toISOString().slice(0,10)).toBe(day(offset))
    expect(stay.allocations[0].end.toISOString().slice(0,10)).toBe(day(offset))
    expect(stay.charges).toHaveLength(0)
    expect(businessDay(stay.endedAt!)).toBe(day(offset))
    const contract = await prisma.reservation.findUniqueOrThrow({where:{id:r.id}})
    expect(contract.checkOut.toISOString().slice(0,10)).toBe(day(planned))
    expect(Number(contract.paidValue)).toBe(value)
    expect((contract.nightlyPrices as unknown[])).toHaveLength(planned+5)
    expect((stay.nightlyPrices as unknown[])).toHaveLength(offset+5)
    expect((await prisma.room.findUniqueOrThrow({where:{id:1}})).guest).toBe("Outro hóspede")
    expect(await prisma.roomConsumptionItem.count({where:{id:"current-drink"}})).toBe(1)
    expect(await prisma.transaction.count({where:{type:"receita"}})).toBe(1)
    const report = await buildManagementReport(prisma,actor,{section:"hospedagem",start:day(-5),end:day(2)},new Date(day(3)+"T15:00:00Z"))
    expect(report.rows).toHaveLength(offset+5)
    expect(report.rows[0].details).toMatchObject({plannedDeparture:day(planned),actualDeparture:day(offset)})
  })
  it("saída efetiva futura, invertida ou informada em entrada ativa não altera a reserva", async () => {
    const r = await op("reserve", payload(-5,-1)) as {id:string;recordVersion:number}
    const input = {...payload(-5,-1),reservationId:r.id,recordVersion:r.recordVersion,keepAgreedPrice:true,reason:"Registro esquecido pela recepção"}
    for(const actualCheckOut of [day(1),day(-6)]) await expect(op("record-completed-stay",{...input,actualCheckOut})).rejects.toMatchObject({status:400})
    await expect(op("check-in",{...input,actualCheckOut:day(-3)})).rejects.toMatchObject({status:400})
    expect((await prisma.reservation.findUniqueOrThrow({where:{id:r.id}})).status).toBe("confirmada")
    expect(await prisma.stay.count()).toBe(0)
  })
  it("a disponibilidade considera a saída efetiva estendida", async () => {
    const r = await op("reserve",payload(-5,-3)) as {id:string;recordVersion:number}
    await op("reserve",payload(-2,0))
    await expect(op("record-completed-stay",{...payload(-5,-3),reservationId:r.id,recordVersion:r.recordVersion,actualCheckOut:day(-1),keepAgreedPrice:true,reason:"Registro esquecido pela recepção"})).rejects.toMatchObject({status:409})
    expect(await prisma.stay.count()).toBe(0)
  })
  it("entrada sem ID não escolhe nem duplica uma reserva existente", async () => {
    await op("reserve", payload())
    await expect(op("check-in", payload())).rejects.toMatchObject({ status: 409 })
    expect(await prisma.reservation.count()).toBe(1)
    expect(await prisma.stay.count()).toBe(0)
  })
  it("registro retroativo exige permissão efetiva, além do motivo", async () => {
    await prisma.user.update({where:{id:actor.id},data:{permissionOverrides:{"hospitality.checkin.backdate":"deny"}}})
    await expect(op("check-in", {...payload(-1,1),reason:"Registro esquecido"})).rejects.toMatchObject({status:403})
    expect(await prisma.stay.count()).toBe(0)
  })
  it("cadastro permite somente pagador próprio ou empresa vinculada", async () => {
    await expect(op("reserve", {...payload(),payerId:"company"})).rejects.toMatchObject({status:409})
    await prisma.customer.update({where:{id:"person"},data:{companyId:"company"}})
    await op("reserve", {...payload(),payerId:"company"})
    expect((await prisma.reservation.findFirstOrThrow()).payerId).toBe("company")
  })
  it("correção do documento preserva a identidade da reserva no check-in", async () => {
    const r = await reservePaid(0)
    await prisma.customer.update({where:{id:"person"},data:{cpfCnpj:"11144477735"}})
    await op("check-in", {...payload(),cpf:"11144477735",reservationId:r.id,recordVersion:r.recordVersion})
    expect((await prisma.stay.findFirstOrThrow()).reservationId).toBe(r.id)
  })
  it("sinal misto de grupo é distribuído uma vez e devolvido nas origens", async () => {
    await prisma.room.create({data:{id:2,number:"102",type:"Standard",capacity:2,status:"disponivel"}})
    await op("cash-open", {openingValue:100})
    const {roomId,guestCount,totalValue,...identity} = payload()
    const result = await op("reserve-group", {...identity,rooms:[{roomId,guestCount,totalValue},{roomId:2,guestCount,totalValue}],initialPayment:{value:300,payments:[{method:"pix",value:120,accountId:"bank"},{method:"dinheiro",value:180}]}}) as {id:string;paidValue:number;recordVersion:number}[]
    expect(result.map(r=>r.paidValue)).toEqual([200,100])
    for(const r of result) await op("cancel-reservation",{reservationId:r.id,recordVersion:r.recordVersion,decision:"refund"})
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({where:{id:"bank"}})).currentBalance)).toBe(1000)
    const movements=await prisma.transaction.findMany({where:{type:"estorno"}})
    expect(movements.reduce((sum,t)=>sum+Number(t.value),0)).toBe(300)
    expect(movements.every(t=>!!t.reversalOfId)).toBe(true)
  })
  it("crédito pessoal retorna ao titular sem virar dinheiro", async () => {
    const r = await reservePaid(0)
    await prisma.guestProfile.update({where:{cpf:r.cpf},data:{creditValue:100}})
    await op("pay-reservation", {reservationId:r.id,value:100,paymentMethod:"credito_hospede"})
    const current=await prisma.reservation.findUniqueOrThrow({where:{id:r.id}})
    await op("cancel-reservation",{reservationId:r.id,recordVersion:current.recordVersion,decision:"refund"})
    expect(Number((await prisma.guestProfile.findUniqueOrThrow({where:{cpf:r.cpf}})).creditValue)).toBe(100)
    expect(await prisma.transaction.count({where:{type:"estorno"}})).toBe(0)
    expect((await prisma.transaction.findFirstOrThrow({where:{type:"credito_concedido"}})).reversalOfId).toBeTruthy()
  })
  it("erro na conta de devolução preserva reserva e pagamentos", async () => {
    const r=await reservePaid()
    await prisma.bankAccount.update({where:{id:"bank"},data:{active:false}})
    await expect(op("cancel-reservation",{reservationId:r.id,recordVersion:r.recordVersion,decision:"refund"})).rejects.toMatchObject({status:409})
    expect((await prisma.reservation.findUniqueOrThrow({where:{id:r.id}})).status).toBe("confirmada")
    expect(await prisma.transaction.count({where:{type:"estorno"}})).toBe(0)
  })
  it("recusa entrada futura antes de qualquer escrita", async () => {
    await expect(op("check-in", payload(1, 3))).rejects.toMatchObject({ status: 400 })
    expect(await prisma.reservation.count()).toBe(0)
    expect(await prisma.stay.count()).toBe(0)
  })
  it("registra chegada anterior com motivo sem falsificar o instante de registro", async () => {
    await expect(op("check-in", payload(-1, 1))).rejects.toMatchObject({ status: 400 })
    await op("check-in", { ...payload(-1, 1), reason: "Entrada não registrada ontem" })
    const stay = await prisma.stay.findFirstOrThrow()
    expect(stay.checkIn.toISOString().slice(0, 10)).toBe(day(-1))
    expect(businessDay(stay.recordedAt)).toBe(day(0))
    expect(stay.arrivalReason).toBe("Entrada não registrada ontem")
  })
  it("reserva anterior é atendida por ID com chegada real hoje e acordo confirmado", async () => {
    const r = await op("reserve", payload(-1, 1)) as { id: string; recordVersion: number }
    const entry = { ...payload(-1, 1), reservationId: r.id, recordVersion: r.recordVersion, checkIn: day(0) }
    await expect(op("check-in", entry)).rejects.toMatchObject({ status: 409 })
    await op("check-in", { ...entry, keepAgreedPrice: true })
    const stay = await prisma.stay.findFirstOrThrow()
    expect(stay.checkIn.toISOString().slice(0, 10)).toBe(day(0))
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).checkIn.toISOString().slice(0, 10)).toBe(day(-1))
    expect(stay.nightlyPrices).toMatchObject([{ date: day(0), total: 200 }])
    const report = await buildManagementReport(prisma, actor, {section:"hospedagem",start:day(-1),end:day(1)}, new Date(day(2)+"T15:00:00Z"))
    expect(report.rows.map(r=>r.date)).toEqual([day(0)])
    expect(report.rows[0].details).toMatchObject({plannedArrival:day(-1),actualArrival:day(0),recordedAt:stay.recordedAt.toISOString()})
    expect(reportCSV(report)).toContain("actualArrival")
  })
  it("hospedagem encerrada retroativa não altera ocupante atual e recebe na data real", async () => {
    await prisma.room.update({ where: { id: 1 }, data: { status: "ocupado", guest: "Outro hóspede" } })
    await op("record-completed-stay", { ...payload(-5, -3), reason: "Hospedagem esquecida na semana", initialPayment: { value: 200, paymentMethod: "pix", accountId: "bank" } })
    expect(await prisma.room.findUnique({ where: { id: 1 } })).toMatchObject({ status: "ocupado", guest: "Outro hóspede" })
    const stay = await prisma.stay.findFirstOrThrow()
    expect(stay.status).toBe("closed")
    expect(businessDay(stay.endedAt!)).toBe(day(-3))
    expect(businessDay((await prisma.transaction.findFirstOrThrow()).date)).toBe(day(0))
    await expect(op("record-completed-stay", { ...payload(-4, -2), reason: "Outro registro conflitante" })).rejects.toMatchObject({ status: 409 })
    await expect(op("reserve", payload(-4, -2))).rejects.toMatchObject({ status: 409 })
  })
  it("falha no recebimento integrado reverte entrada, reserva e saldo", async () => {
    await expect(op("check-in", { ...payload(), initialPayment: { value: 100, paymentMethod: "pix", accountId: "missing" } })).rejects.toBeDefined()
    expect(await prisma.stay.count()).toBe(0)
    expect(await prisma.reservation.count()).toBe(0)
    expect((await prisma.room.findUniqueOrThrow({ where: { id: 1 } })).status).toBe("disponivel")
  })
  it("cancelamento sem sinal aceita motivo vazio ou preenchido", async () => {
    const r = await reservePaid(0)
    await op("cancel-reservation", { reservationId: r.id, decision: "refund", cancellationReason: "   " })
    expect(await prisma.reservation.findUnique({ where: { id: r.id } })).toMatchObject({ status: "cancelada", cancellationReason: null })
    expect(await prisma.transaction.count()).toBe(0)
  })
  it.each([["refund", 100, 0], ["retain", 0, 100], ["refund", 60, 40]] as const)("cancelamento %s devolve %s e retém %s preservando o recebido", async (decision, returned, retained) => {
    const r = await reservePaid()
    await op("cancel-reservation", { reservationId: r.id, recordVersion: r.recordVersion, decision, refundValue: returned, cancellationReason: "Mudança de planos", ...(retained ? { financialReason: "Retenção acordada com o cliente" } : {}) })
    const result = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })
    expect(Number(result.paidValue)).toBe(100)
    expect(Number(result.refundedValue)).toBe(returned)
    expect(Number(result.retainedValue)).toBe(retained)
    expect(result.cancellationReason).toBe("Mudança de planos")
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: "bank" } })).currentBalance)).toBe(1100 - returned)
  })
  it("retenção sem justificativa falha; cancelamentos concorrentes não duplicam reembolso", async () => {
    const r = await reservePaid()
    await expect(op("cancel-reservation", { reservationId: r.id, decision: "retain" })).rejects.toMatchObject({ status: 400 })
    const results = await Promise.allSettled([1, 2].map(() => op("cancel-reservation", { reservationId: r.id, recordVersion: r.recordVersion, decision: "refund" })))
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
    expect(await prisma.transaction.count({ where: { type: "estorno" } })).toBe(1)
  })
  it("no-show considera horário configurado", async () => {
    await prisma.systemSettings.create({ data: { id: "settings", pousadaName: "Pousada", discountCeiling: 5, checkInTime: "23:59", checkOutTime: "12:00" } })
    const r = await reservePaid(0)
    await expect(op("cancel-reservation", { reservationId: r.id, status: "noshow", decision: "refund" })).rejects.toMatchObject({ status: 409 })
    await prisma.systemSettings.update({ where: { id: "settings" }, data: { checkInTime: "00:00" } })
    await op("cancel-reservation", { reservationId: r.id, status: "noshow", decision: "refund" })
  })
})
