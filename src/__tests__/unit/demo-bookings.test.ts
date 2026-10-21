import { beforeEach, describe, expect, it } from "vitest"
import { createDataStore } from "@/lib/data/repositories"
import { demoBookingOperation } from "@/lib/data/demo-bookings"
import { businessDay } from "@/lib/utils/business-values"
import type { DataStore, IStorageAdapter } from "@/lib/data/types"
import type { Reservation } from "@/lib/store"

const day = (n = 0) => new Date(Date.parse(businessDay()) + n * 86400000).toISOString().slice(0, 10)
let store: DataStore
const command = (kind: string, payload: unknown, denied?: string) => demoBookingOperation(store, kind, payload, p => p !== denied, "Teste")
const base = () => ({ roomId: 1, guestCount: 1, totalValue: 200, cpf: "52998224725", guestName: "Pessoa", payerId: "person", checkIn: day(), checkOut: day(2) })
beforeEach(async () => {
  let state: Record<string, unknown> = {}
  const adapter: IStorageAdapter = {
    get: async <T,>(key: string) => structuredClone(state[key] ?? null) as T | null,
    set: async (key, value) => { state[key] = structuredClone(value) },
    clear: async () => { state = {} }, remove: async key => { delete state[key] }, keys: async () => Object.keys(state),
    export: async () => JSON.stringify(state), import: async json => { state = JSON.parse(json) }, getUsage: async () => 0,
  }
  store = createDataStore({ adapter })
  await store.importAll(JSON.stringify({
    customers: [{ id: "person", name: "Pessoa", cpfCnpj: "52998224725", roles: ["guest", "payer"], active: true }],
    guests: [{ cpf: "52998224725", customerId: "person", name: "Pessoa", totalStays: 0, avgTicket: 0, noShows: 0 }],
    rooms: [{ id: 1, number: "101", capacity: 2, type: "Standard", status: "disponivel", timeline: [] }],
    lodgingTariffs: [{ id: "tariff", name: "Padrão", roomType: "Standard", minGuests: 1, maxGuests: 2, pricePerPerson: 100, active: true, validFrom: day(-365) }],
    bankAccounts: [{ id: "bank", name: "Conta", type: "corrente", active: true, initialBalance: 1000, currentBalance: 1000 }],
    systemSettings: [{ id: "settings", pousadaName: "Teste", checkInTime: "23:59", checkOutTime: "12:00", discountCeiling: 5 }],
  }))
})
async function reserve() {
  const { roomId, guestCount, totalValue, ...identity } = base()
  await command("reserve-group", { ...identity, rooms: [{ roomId, guestCount, totalValue }], initialPayment: { value: 100, payments: [{ method: "pix", value: 100, accountId: "bank" }] } })
  return (await store.reservations.getAll())[0]
}
describe("Reservas e entradas na demonstração isolada", () => {
  it.each([-4,-1])("saída efetiva %s preserva a previsão e o pagamento na demonstração", async offset => {
    const input = {...base(),checkIn:day(-5),checkOut:day(-3)}
    const {roomId,guestCount,totalValue,...identity} = input
    await command("reserve-group",{...identity,rooms:[{roomId,guestCount,totalValue}],initialPayment:{value:200,payments:[{method:"pix",value:200,accountId:"bank"}]}})
    const r = (await store.reservations.getAll())[0]
    await store.rooms.update(1,{status:"ocupado",guest:"Outro hóspede"})
    await command("record-completed-stay",{...input,reservationId:r.id,recordVersion:r.recordVersion,actualCheckOut:day(offset),keepAgreedPrice:true,reason:"Registro esquecido pela recepção"})
    expect(await store.reservations.getById(r.id)).toMatchObject({status:"checkout",checkOut:day(-3),paidValue:200})
    const stay = (await store.stays.getAll())[0]
    expect(stay).toMatchObject({status:"closed",checkOut:day(offset),endedAt:day(offset)+"T12:00:00Z"})
    expect(stay.allocations[0].end).toBe(day(offset))
    expect(stay.nightlyPrices).toHaveLength(offset+5)
    expect((await store.rooms.getById(1))?.guest).toBe("Outro hóspede")
    expect(await store.transactions.count()).toBe(1)
  })
  it("sinal e reserva confirmam juntos e a devolução conserva o recebido", async () => {
    const r = await reserve()
    expect(r.paidValue).toBe(100)
    expect((await store.bankAccounts.getById("bank"))?.currentBalance).toBe(1100)
    await command("cancel-reservation", { reservationId: r.id, recordVersion: r.recordVersion, decision: "refund", refundValue: 60, financialReason: "Retenção acordada", cancellationReason: "  Viagem cancelada  ", status: "cancelada" })
    expect(await store.reservations.getById(r.id)).toMatchObject({ paidValue: 100, refundedValue: 60, retainedValue: 40, cancellationReason: "Viagem cancelada" })
    expect((await store.bankAccounts.getById("bank"))?.currentBalance).toBe(1040)
  })
  it("falha financeira não deixa reserva, ocupação ou saldo parcial", async () => {
    await expect(command("check-in", { ...base(), initialPayment: { value: 100, payments: [{ method: "pix", value: 100, accountId: "invalid" }] } })).rejects.toThrow("conta")
    expect(await store.reservations.count()).toBe(0)
    expect(await store.stays.count()).toBe(0)
    expect((await store.rooms.getById(1))?.status).toBe("disponivel")
    expect((await store.bankAccounts.getById("bank"))?.currentBalance).toBe(1000)
  })
  it("recusa entrada futura e retroativo sem permissão", async () => {
    await expect(command("check-in", { ...base(), checkIn: day(1) })).rejects.toThrow("futuro")
    await expect(command("check-in", { ...base(), checkIn: day(-1), totalValue: 300, reason: "Entrada esquecida" }, "hospitality.checkin.backdate")).rejects.toThrow("permissão")
    expect(await store.stays.count()).toBe(0)
  })
  it("atende reserva por ID e duas confirmações não criam duas hospedagens", async () => {
    const r = await reserve()
    const payload = { ...base(), reservationId: r.id, recordVersion: r.recordVersion }
    const results = await Promise.allSettled([command("check-in", payload), command("check-in", payload)])
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
    expect(await store.stays.count()).toBe(1)
    expect((await store.stays.getAll())[0].payments.reduce((sum, p) => sum + p.value, 0)).toBe(100)
  })
  it("registro encerrado retroativo preserva o ocupante atual", async () => {
    await store.rooms.update(1, { status: "ocupado", guest: "Outro hóspede" })
    await command("record-completed-stay", { ...base(), checkIn: day(-5), checkOut: day(-3), reason: "Registro esquecido na semana", initialPayment: { value: 200, payments: [{ method: "pix", value: 200, accountId: "bank" }] } })
    expect((await store.rooms.getById(1))?.guest).toBe("Outro hóspede")
    expect((await store.stays.getAll())[0]).toMatchObject({ status: "closed", checkIn: day(-5), recordedAt: expect.stringContaining(day()) })
  })
  it("no-show e permissão financeira valem também na demonstração", async () => {
    const r: Reservation = await reserve()
    await expect(command("cancel-reservation", { reservationId: r.id, recordVersion: r.recordVersion, decision: "refund", status: "noshow" })).rejects.toThrow("horário")
    await expect(command("cancel-reservation", { reservationId: r.id, recordVersion: r.recordVersion, decision: "retain", status: "cancelada", financialReason: "Acordado com o cliente" }, "reservations.feeCredit")).rejects.toThrow("permissão")
    expect((await store.reservations.getById(r.id))?.status).toBe("confirmada")
  })
})
