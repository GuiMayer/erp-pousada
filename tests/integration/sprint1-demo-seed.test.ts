import { afterAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db/client"

// Keep the production guard closed; this test permits only the isolated CI DB.
vi.mock("@/lib/server/demo-guard", () => ({ assertDemoTarget: (url: string | undefined) => {
  if (!url || new URL(url).pathname !== "/erp_test") throw new Error("Seed de teste somente em erp_test")
} }))
import { seedDemo } from "@/lib/server/demo-seed"
if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw new Error("Seed de teste somente em erp_test")
const clearExamples = () => prisma.$executeRawUnsafe('TRUNCATE TABLE "users", "customers", "rooms", "guest_profiles", "suppliers", "product_categories", "system_settings", "bank_accounts", "cost_centers", "expense_categories", "expenses", "transactions", "cash_closes", "notification_preferences", "notification_events" CASCADE')
afterAll(async () => { await clearExamples(); vi.unstubAllEnvs(); await prisma.$disconnect() })
describe("Exemplos da Sprint 1", () => {
  it("inicializa os exemplos usando cadastros e tarifas reais sem sessão residual", async () => {
    await clearExamples()
    vi.stubEnv("DEMO_LOGIN_PASSWORD", "teste")
    await seedDemo()
    expect(await prisma.room.count()).toBe(12)
    expect(await prisma.lodgingTariff.count()).toBe(6)
    expect(await prisma.authSession.count()).toBe(0)
    expect(await prisma.customer.findUnique({ where: { id: "demo-company" } })).toMatchObject({ roles: ["payer"] })
    const booking = await prisma.reservation.findFirstOrThrow({ where: { payerId: "demo-company" } })
    expect(Number(booking.totalValue)).toBe(600)
    expect(booking.nightlyPrices).toHaveLength(3)
    expect(await prisma.supplier.findUnique({ where: { id: "demo-supplier" } })).toMatchObject({ customerId: expect.any(String) })
    await expect(seedDemo()).rejects.toThrow("não está vazio")
  })
})
