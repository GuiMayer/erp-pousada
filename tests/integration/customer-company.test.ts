import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import type { Actor } from "@/lib/server/auth"
import { createCollectionItem, updateCollectionItem, deleteCollectionItem, exportAllCollections, importAllCollections } from "@/lib/server/db/relational-data-service"
import { executeOperation } from "@/lib/server/operations"

if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw new Error("Vínculo empresarial exige banco exclusivo erp_test")
const prefix = `company-${randomUUID()}`, employerId = `${prefix}-a`, secondId = `${prefix}-b`, personId = `${prefix}-person`
let actor: Actor
beforeAll(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "customers", "guest_profiles", "suppliers", "rooms" CASCADE')
  const user = await prisma.user.create({ data: { id: prefix, username: prefix, fullName: "Teste empresa", password: "test-only", role: "supervisor", createdBy: "test" } })
  const session = await prisma.authSession.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 600000) } })
  actor = { id: user.id, username: user.username, role: "supervisor", sessionId: session.id, approvedUntil: null, permissions: ALL_PERMISSIONS }
  await createCollectionItem("customers", { id: employerId, name: "Empresa A", cpfCnpj: "12ABC34501DE35", roles: ["payer"], active: true }, actor)
  await createCollectionItem("customers", { id: secondId, name: "Empresa B", cpfCnpj: "11222333000181", roles: ["payer"], active: true }, actor)
})
afterAll(async () => { await prisma.user.deleteMany({ where: { id: prefix } }); await prisma.$disconnect() })
describe("Empresa vinculada ao hóspede", () => {
  it("cadastro compartilha a identidade e aceita empresa atual opcional", async () => {
    await createCollectionItem("customers", { id: personId, name: "Pessoa", cpfCnpj: "52998224725", roles: ["guest", "payer"], companyId: employerId, active: true }, actor)
    expect(await prisma.customer.findUnique({ where: { id: personId } })).toMatchObject({ companyId: employerId })
    expect(await prisma.guestProfile.findUnique({ where: { customerId: personId } })).toMatchObject({ cpf: "52998224725" })
  })
  it("recusa auto vínculo, empresa como funcionário, pessoa física como empresa e alvo inexistente", async () => {
    const person = await prisma.customer.findUniqueOrThrow({ where: { id: personId } })
    await expect(updateCollectionItem("customers", personId, { recordVersion: person.recordVersion, companyId: personId }, actor)).rejects.toThrow("si mesma")
    await expect(updateCollectionItem("customers", personId, { recordVersion: person.recordVersion, companyId: "missing" }, actor)).rejects.toThrow("CNPJ")
    const company = await prisma.customer.findUniqueOrThrow({ where: { id: employerId } })
    await expect(updateCollectionItem("customers", employerId, { recordVersion: company.recordVersion, companyId: secondId }, actor)).rejects.toThrow("CPF")
    await expect(createCollectionItem("customers", { id: `${prefix}-other`, name: "Outra", cpfCnpj: "11144477735", roles: ["guest"], companyId: personId, active: true }, actor)).rejects.toThrow("CNPJ")
  })
  it("troca cadastral preserva pagador e preço da reserva e não recria dívida", async () => {
    await prisma.room.create({ data: { id: 1909, number: "company-room", type: prefix, status: "disponivel", capacity: 2 } })
    await createCollectionItem("lodgingTariffs", { id: prefix, name: "Tarifa", roomType: prefix, minGuests: 1, maxGuests: 2, pricePerPerson: 120, validFrom: "2026-01-01", active: true }, actor)
    const booking = await executeOperation(actor, randomUUID(), "reserve", { roomId: 1909, cpf: "52998224725", guestName: "Pessoa", guestCount: 1, payerId: employerId, checkIn: "2026-11-01", checkOut: "2026-11-02", totalValue: 120 }) as { id: string }
    const person = await prisma.customer.findUniqueOrThrow({ where: { id: personId } })
    await updateCollectionItem("customers", personId, { recordVersion: person.recordVersion, companyId: secondId }, actor)
    await expect(updateCollectionItem("customers", personId, { recordVersion: person.recordVersion, companyId: null }, actor)).rejects.toMatchObject({ status: 409 })
    const saved = await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id } })
    expect(saved.payerId).toBe(employerId); expect(Number(saved.totalValue)).toBe(120)
    expect(await prisma.accountReceivable.count({ where: { customerId: secondId } })).toBe(0)
    const second = await prisma.customer.findUniqueOrThrow({ where: { id: secondId } })
    await expect(updateCollectionItem("customers", secondId, { recordVersion: second.recordVersion, roles: ["supplier"] }, actor)).rejects.toThrow("pessoas vinculadas")
    await expect(updateCollectionItem("customers", secondId, { recordVersion: second.recordVersion, cpfCnpj: "11144477735" }, actor)).rejects.toThrow("pessoas vinculadas")
  })
  it("inativar empresa preserva vínculo existente mas impede nova associação", async () => {
    const second = await prisma.customer.findUniqueOrThrow({ where: { id: secondId } })
    await deleteCollectionItem("customers", secondId, prisma, actor, second.recordVersion)
    const person = await prisma.customer.findUniqueOrThrow({ where: { id: personId } })
    await updateCollectionItem("customers", personId, { recordVersion: person.recordVersion, notes: "Histórico preservado" }, actor)
    await expect(createCollectionItem("customers", { id: `${prefix}-inactive`, name: "Outra", cpfCnpj: "11144477735", roles: ["guest"], companyId: secondId, active: true }, actor)).rejects.toThrow("Reative")
  })
  it("banco protege tipo do vínculo e referência mesmo em escrita direta", async () => {
    await expect(prisma.customer.update({ where: { id: personId }, data: { companyId: personId } })).rejects.toThrow()
    await expect(prisma.customer.delete({ where: { id: secondId } })).rejects.toThrow()
    await expect(prisma.customer.update({ where: { id: secondId }, data: { roles: ["supplier"] } })).rejects.toThrow()
  })
  it("restauração importa empresa antes da pessoa e conserva vínculo com empresa inativa", async () => {
    const snapshot = JSON.parse(await exportAllCollections())
    snapshot.customers.sort((a: { companyId?: string }, b: { companyId?: string }) => Number(!!b.companyId) - Number(!!a.companyId))
    await importAllCollections(JSON.stringify(snapshot))
    expect(await prisma.customer.findUnique({ where: { id: personId } })).toMatchObject({ companyId: secondId })
    expect(await prisma.customer.findUnique({ where: { id: secondId } })).toMatchObject({ active: false })
    const person = await prisma.customer.findUniqueOrThrow({ where: { id: personId } })
    await updateCollectionItem("customers", personId, { recordVersion: person.recordVersion, companyId: null }, actor)
    expect(await prisma.customer.findUnique({ where: { id: personId } })).toMatchObject({ companyId: null })
  })
})
