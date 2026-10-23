import { z } from "zod"
import { acceptsPayment, cardPayoutAmounts } from "@/lib/payment-accounts"
import { withDemoTransaction } from "./demo-transaction"
import type { DataStore } from "./types"

export function demoCardPayout(store: DataStore, payload: unknown, can: (p: string) => boolean, username: string, requestId: string) {
  return withDemoTransaction(store, async staged => {
    if (!can("bankAccounts.transfer")) throw Error("Você não tem permissão para registrar repasse")
    const input = z.object({ fromAccountId: z.string().min(1), toAccountId: z.string().min(1), gross: z.number(), fee: z.number() }).strict().parse(payload)
    const amounts = cardPayoutAmounts(input.gross, input.fee)
    const previous = (await staged.auditLog.getAll()).find(a => a.entityId === requestId && a.action === "Repasse de cartão registrado")
    if (previous) {
      if (JSON.stringify(previous.metadata?.input) !== JSON.stringify(input)) throw Error("Confirmação reutilizada com valores diferentes")
      return { success: true, batchId: requestId, ...amounts }
    }
    const source = await staged.bankAccounts.getById(input.fromAccountId), bank = await staged.bankAccounts.getById(input.toAccountId)
    if (!source?.active || source.type !== "cartao" || !bank || !acceptsPayment(bank, "PIX")) throw Error("Escolha Cartões a receber e uma conta bancária ativa")
    if (Math.round(source.currentBalance * 100) < Math.round(amounts.gross * 100)) throw Error("Repasse excede o saldo de cartões a receber")
    await staged.bankAccounts.update(source.id, { currentBalance: Math.round((source.currentBalance - amounts.gross) * 100) / 100, recordVersion: (source.recordVersion ?? 0) + 1 })
    await staged.bankAccounts.update(bank.id, { currentBalance: Math.round((bank.currentBalance + amounts.net) * 100) / 100, recordVersion: (bank.recordVersion ?? 0) + 1 })
    const now = new Date().toISOString(), common = { date: now, description: "Repasse de cartão", originType: "card-payout", originId: requestId, batchId: requestId, responsible: username }
    await staged.transactions.create({ ...common, type: "transferencia_saida", value: amounts.gross, accountId: source.id })
    if (amounts.net) await staged.transactions.create({ ...common, type: "transferencia_entrada", value: amounts.net, accountId: bank.id })
    if (amounts.fee) await staged.transactions.create({ ...common, type: "despesa", category: "Taxas de cartão", value: amounts.fee })
    await staged.auditLog.create({ date: now, user: username, action: "Repasse de cartão registrado", reference: requestId, entityId: requestId, entityType: "bankAccounts", operation: "action", metadata: { input } })
    return { success: true, batchId: requestId, ...amounts }
  })
}
