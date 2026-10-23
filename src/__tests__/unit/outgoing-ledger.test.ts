import { describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"
import { recordLedger } from "@/lib/server/business-finance"
import type { Actor } from "@/lib/server/auth"

const actor: Actor = { id: "test", username: "Pessoa fictícia", role: "supervisor", sessionId: "test", approvedUntil: null }
describe("Despesas não utilizam o controle de cartões recebidos", () => {
  it.each(["debito", "credito"])("%s preserva banco e não exige turno", async method => {
    const account = { id: "bank", active: true, type: "conta_corrente" }
    const tx = {
      bankAccount: { findMany: vi.fn().mockResolvedValue([account]), findUniqueOrThrow: vi.fn().mockResolvedValue(account), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      transaction: { create: vi.fn().mockImplementation(({ data }) => data) },
    }
    const entry = await recordLedger(tx as unknown as Prisma.TransactionClient, actor, "Despesa fictícia", new Prisma.Decimal(20), "despesa", method)
    expect(tx.bankAccount.findMany).toHaveBeenCalledWith({ where: { active: true, type: { notIn: ["cartao", "caixa"] } }, take: 2 })
    expect(tx.bankAccount.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { recordVersion: { increment: 1 }, currentBalance: { decrement: new Prisma.Decimal(20) } } }))
    expect(entry.accountId).toBe("bank")
    expect(entry.operationalSessionId).toBeUndefined()
  })
  it("recusa o controle de cartões como conta de pagamento de despesa", async () => {
    const tx = { bankAccount: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "cards", active: true, type: "cartao" }) } }
    await expect(recordLedger(tx as unknown as Prisma.TransactionClient, actor, "Despesa fictícia", new Prisma.Decimal(20), "despesa", "debito", "cards")).rejects.toMatchObject({ status: 409 })
  })
})
