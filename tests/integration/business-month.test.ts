import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { executeOperation } from "@/lib/server/operations"
import type { Actor } from "@/lib/server/auth"

if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw new Error("Somente erp_test")
const id = `month-${randomUUID()}`
const actor: Actor = { id, username: id, role: "supervisor", sessionId: "test", approvedUntil: null }
beforeAll(async () => {
  await prisma.employee.create({ data: { id, name: "Exemplo", cpf: id, role: "Teste", active: true, consumptionLimit: 10, mealBenefit: {} } })
  await prisma.productCategory.create({ data: { id, name: "Teste", icon: "Cup", color: "blue" } })
  await prisma.pOSProduct.create({ data: { id, name: "Teste", price: 10, categoryId: id, trackStock: false } })
})
afterEach(() => vi.useRealTimers())
afterAll(async () => {
  await prisma.employeeConsumption.deleteMany({ where: { employeeId: id } })
  await prisma.employee.delete({ where: { id } })
  await prisma.pOSProduct.delete({ where: { id } })
  await prisma.productCategory.delete({ where: { id } })
  await prisma.$disconnect()
})
describe("Limite de consumo no mês operacional", () => {
  it("não reinicia na virada UTC e duas solicitações concorrentes respeitam o limite", async () => {
    await prisma.employeeConsumption.create({ data: { id: `${id}-prior`, employeeId: id, employeeName: "Teste", total: 10, category: "lanche", paymentType: "desconto", timestamp: new Date("2026-10-31T20:00:00Z"), registeredBy: id } })
    const payload = { employeeId: id, category: "lanche", paymentType: "desconto", items: [{ productId: id, quantity: 1 }] }
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-01T01:00:00Z"))
    await expect(executeOperation(actor, randomUUID(), "employee-consumption", payload)).rejects.toMatchObject({ status: 409, message: "Limite mensal excedido" })
    vi.setSystemTime(new Date("2026-11-01T03:00:00Z"))
    const results = await Promise.allSettled([1, 2].map(() => executeOperation(actor, randomUUID(), "employee-consumption", payload)))
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1)
  })
})
