import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { ALL_PERMISSIONS, PROFILES } from "@/lib/permissions"
import type { Actor } from "@/lib/server/auth"
import { createCollectionItem, updateCollectionItem, deleteCollectionItem, getCollection } from "@/lib/server/db/relational-data-service"
import { executeOperation } from "@/lib/server/operations"

if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw new Error("S1 exige banco exclusivo erp_test")
const prefix = `s1-${randomUUID()}`
const guestCpf = "52998224725", companyDoc = "12ABC34501DE35"
let actor: Actor, guestId: string, companyId: string
let roomId: number
let reservationId: string
beforeAll(async () => {
  // Earlier suites can have used these public test documents; isolated test DB only.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "customers", "rooms", "guest_profiles", "suppliers", "product_categories" CASCADE')
  const user = await prisma.user.create({ data: { id: prefix, username: prefix, password: "test-only", fullName: "Teste S1", role: "supervisor", createdBy: "test" } })
  const session = await prisma.authSession.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 600000) } })
  actor = { id: user.id, username: user.username, role: "supervisor", sessionId: session.id, approvedUntil: null, permissions: ALL_PERMISSIONS }
  roomId = 909
  await prisma.room.create({ data: { id: roomId, number: "S1-909", type: "Standard", status: "disponivel", capacity: 3 } })
})
afterAll(async () => { await prisma.user.deleteMany({ where: { id: prefix } }); await prisma.$disconnect() })
describe("Sprint 1 no PostgreSQL", () => {
  it("cadastros rápido e completo usam a mesma identidade e documento único", async () => {
    const guest = await createCollectionItem("customers", { id: `${prefix}-guest`, name: "Hóspede Exemplo", cpfCnpj: "529.982.247-25", roles: ["guest", "payer"], active: true }, actor) as { id: string }
    guestId = guest.id
    expect(await prisma.guestProfile.findUnique({ where: { customerId: guestId } })).toMatchObject({ cpf: guestCpf, name: "Hóspede Exemplo" })
    await expect(createCollectionItem("customers", { id: `${prefix}-duplicate`, name: "Outra pessoa", cpfCnpj: guestCpf, active: true }, actor)).rejects.toThrow("já cadastrado")
    const company = await createCollectionItem("customers", { id: `${prefix}-company`, name: "Empresa Exemplo", cpfCnpj: "12.abc.345/01de-35", active: true, roles: ["payer"] }, actor) as { id: string }
    companyId = company.id
    expect(await prisma.customer.findUnique({ where: { id: companyId } })).toMatchObject({ cpfCnpj: companyDoc })
  })
  it("fornecedor reaproveita a empresa e mantém os papéis", async () => {
    const supplier = await createCollectionItem("suppliers", { id: `${prefix}-supplier`, name: "Empresa Exemplo", cnpj: companyDoc, active: true, paymentTerms: "30 dias" }, actor) as { id: string; customerId: string; recordVersion: number }
    expect(supplier.customerId).toBe(companyId)
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: companyId } })).roles).toEqual(["payer", "supplier"])
    const edited = await updateCollectionItem("suppliers", supplier.id, { recordVersion: supplier.recordVersion, paymentTerms: "15 dias" }, actor) as { recordVersion: number }
    expect(edited.recordVersion).toBe((await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } })).recordVersion)
    await expect(createCollectionItem("suppliers", { id: `${prefix}-supplier-duplicate`, name: "Empresa Exemplo", cnpj: companyDoc, active: true }, actor)).rejects.toThrow("já cadastrada")
  })
  it("não permite duas tarifas de mesmo escopo nem mesmo em concorrência", async () => {
    const base = { name: "Uma pessoa", roomType: "Standard", roomId: null, minGuests: 1, maxGuests: 1, pricePerPerson: 120, validFrom: "2026-01-01", active: true }
    const attempts = await Promise.allSettled(["a", "b"].map(id => createCollectionItem("lodgingTariffs", { ...base, id: `${prefix}-${id}` }, actor)))
    expect(attempts.filter(a => a.status === "fulfilled")).toHaveLength(1)
    await createCollectionItem("lodgingTariffs", { ...base, id: `${prefix}-two`, name: "Duas pessoas", minGuests: 2, maxGuests: 3, pricePerPerson: 100 }, actor)
  })
  it("calcula no servidor, guarda pagador e preço por noite e bloqueia valor adulterado", async () => {
    const payload = { roomId, cpf: guestCpf, guestName: "Hóspede Exemplo", payerId: companyId, guestCount: 2, checkIn: "2026-10-09", checkOut: "2026-10-11", totalValue: 400 }
    await expect(executeOperation(actor, randomUUID(), "reserve", { ...payload, totalValue: 1 })).rejects.toThrow("Tarifa alterada")
    await expect(executeOperation(actor, randomUUID(), "reserve", { ...payload, guestCount: 4 })).rejects.toThrow("lotação")
    const reservation = await executeOperation(actor, randomUUID(), "reserve", payload) as { id: string; totalValue: number; nightlyPrices: unknown[] }
    reservationId = reservation.id
    expect(reservation.totalValue).toBe(400); expect(reservation.nightlyPrices).toHaveLength(2)
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).payerId).toBe(companyId)
  })
  it("editar tarifa não altera reserva; check-in mantém o preço acordado", async () => {
    const t = await prisma.lodgingTariff.findUniqueOrThrow({ where: { id: `${prefix}-two` } })
    await updateCollectionItem("lodgingTariffs", t.id, { recordVersion: t.recordVersion, pricePerPerson: 150 }, actor)
    const stay = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })
    expect(Number(stay.totalValue)).toBe(400)
    await executeOperation(actor, randomUUID(), "check-in", { roomId, cpf: guestCpf, guestName: "Hóspede Exemplo", guestCount: 2, payerId: companyId, checkIn: "2026-10-09", checkOut: "2026-10-11", totalValue: 400 })
    expect(Number((await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).totalValue)).toBe(400)
  })
  it("corrigir documento conserva ID, créditos e reservas do hóspede", async () => {
    await prisma.guestProfile.update({ where: { cpf: guestCpf }, data: { creditValue: 80 } })
    const person = await prisma.customer.findUniqueOrThrow({ where: { id: guestId } })
    await updateCollectionItem("customers", guestId, { recordVersion: person.recordVersion, cpfCnpj: "11144477735" }, actor)
    expect(await prisma.guestProfile.findUnique({ where: { customerId: guestId } })).toMatchObject({ cpf: guestCpf })
    expect(Number((await prisma.guestProfile.findUniqueOrThrow({ where: { cpf: guestCpf } })).creditValue)).toBe(80)
    const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })
    expect(reservation.cpf).toBe(guestCpf)
    const future = await executeOperation(actor, randomUUID(), "reserve", { roomId, cpf: "11144477735", guestName: "Nome informado diferente", guestCount: 1, checkIn: "2026-11-01", checkOut: "2026-11-02", totalValue: 120 }) as { id: string }
    await prisma.reservation.update({ where: { id: future.id }, data: { paidValue: 10 } })
    const paid = await prisma.reservation.findUniqueOrThrow({ where: { id: future.id } })
    const edited = await executeOperation(actor, randomUUID(), "edit-reservation", { id: paid.id, recordVersion: paid.recordVersion, roomId, cpf: "11144477735", guestName: "Nome informado diferente", guestCount: 1, checkIn: "2026-11-01", checkOut: "2026-11-02", totalValue: 120 }) as { cpf: string; guestName: string }
    expect(edited).toMatchObject({ cpf: guestCpf, guestName: "Hóspede Exemplo" })
    await deleteCollectionItem("customers", guestId, prisma, actor, (await prisma.customer.findUniqueOrThrow({ where: { id: guestId } })).recordVersion)
    expect(await prisma.customer.findUnique({ where: { id: guestId } })).toMatchObject({ active: false })
    expect(await prisma.guestProfile.findUnique({ where: { customerId: guestId } })).toMatchObject({ active: false })
  })
  it("cadastro de bebidas controla código único e inativa sem apagar histórico", async () => {
    await prisma.productCategory.create({ data: { id: prefix, name: "Bebidas", icon: "Cup", color: "blue" } })
    await createCollectionItem("posProducts", { id: prefix, name: "Água", price: 5, categoryId: prefix, barcode: "789123", unit: "un", trackStock: false, active: true }, actor)
    await expect(createCollectionItem("posProducts", { id: `${prefix}-dup`, name: "Outra água", price: 6, categoryId: prefix, barcode: "789123" }, actor)).rejects.toThrow("já cadastrado")
    await deleteCollectionItem("posProducts", prefix, prisma, actor, 0)
    expect((await getCollection("posProducts"))).toEqual(expect.arrayContaining([expect.objectContaining({ id: prefix, active: false })]))
  })
  it("recepção consulta tarifas e cadastra pessoas mas não autoriza preço excepcional", async () => {
    expect(PROFILES.recepcao.permissions).toContain("lodgingTariffs.read")
    expect(PROFILES.recepcao.permissions).toContain("customers.create")
    expect(PROFILES.recepcao.permissions).not.toContain("lodgingTariffs.override")
    const limitedId = `${prefix}-reception`
    await prisma.user.create({ data: { id: limitedId, username: limitedId, fullName: "Recepção Exemplo", password: "test-only", role: "operador", accessProfile: "recepcao", createdBy: "test" } })
    const session = await prisma.authSession.create({ data: { userId: limitedId, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 600000) } })
    const limited: Actor = { ...actor, id: limitedId, username: limitedId, sessionId: session.id, role: "operador", permissions: PROFILES.recepcao.permissions }
    await expect(executeOperation(limited, randomUUID(), "reserve", { roomId, cpf: "11144477735", guestName: "Hóspede Exemplo", guestCount: 1, checkIn: "2026-10-12", checkOut: "2026-10-13", totalValue: 10, priceExceptionReason: "Preço combinado" })).rejects.toMatchObject({ status: 403 })
    await prisma.user.delete({ where: { id: limitedId } })
  })
})
