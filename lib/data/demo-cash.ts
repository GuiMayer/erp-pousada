import { z } from "zod"
import type { DataStore } from "./types"
import type { CashClose } from "@/lib/store"
import { withDemoTransaction } from "./demo-transaction"
import { cashIncoming } from "@/lib/payments"
import { ApiError } from "./conflicts"

const money = z.number().finite().nonnegative().max(999999999).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < .00001)
const reason = z.string().trim().min(5).max(500)
const cents = (value: number) => Math.round(value * 100)
export const demoCashKinds = ["cash-open", "cash-close", "cash-movement", "cash-review", "cash-inspect"]
export function demoCashOperation(store: DataStore, kind: string, payload: unknown, can: (p: string) => boolean, actor: { id: string; username: string }, requestId: string) {
  return withDemoTransaction(store, async staged => {
    const demand = (permission: string) => { if (!can(permission)) throw Error("Você não tem permissão para esta ação") }
    const turns = await staged.cashCloses.getAll(), entries = await staged.transactions.getAll(), now = new Date().toISOString()
    const active = turns.find(t => t.status === "aberto")
    const totals = (turn: CashClose) => {
      const list = entries.filter(e => e.cashSessionId === turn.id)
      const incomingValue = list.filter(e => cashIncoming(e.type)).reduce((v, e) => v + cents(e.value), 0) / 100
      const outgoingValue = list.filter(e => !cashIncoming(e.type)).reduce((v, e) => v + cents(Math.abs(e.value)), 0) / 100
      return { incomingValue, outgoingValue, expectedValue: (cents(turn.openingValue ?? 0) + cents(incomingValue) - cents(outgoingValue)) / 100 }
    }
    const audit = (action: string, reference: string) => staged.auditLog.create({ date: now, user: actor.username, action, reference, entityType: "cashCloses", entityId: reference, operation: kind === "cash-open" ? "create" : kind === "cash-movement" ? "action" : "update" })
    if (kind === "cash-open") {
      demand("cash.open")
      const input = z.object({ openingValue: money, openingReason: reason.optional() }).strict().parse(payload)
      const existing = turns.find(t => t.id === requestId)
      if (existing) {
        if (existing.openingValue !== input.openingValue || existing.responsibleUserId !== actor.id || existing.openingReason !== input.openingReason) throw Error("Confirmação reutilizada com dados diferentes")
        return existing
      }
      if (active) throw Error("Já existe um caixa aberto")
      const previous = turns.filter(t => t.status === "fechado").sort((a, b) => (b.closedAt ?? b.date).localeCompare(a.closedAt ?? a.date))[0]
      if (previous && cents(previous.retainedValue ?? 0) !== cents(input.openingValue) && !input.openingReason) throw new ApiError("Informe o motivo da alteração do fundo", 409, "CASH_OPENING_DIFFERENCE")
      const data: CashClose = { id: requestId, status: "aberto", date: now, openedAt: now, operator: actor.username, responsibleUserId: actor.id, openingValue: input.openingValue, openingReason: input.openingReason, previousSessionId: previous?.id, expectedValue: input.openingValue, physicalValue: 0, divergence: 0 }
      const turn = await staged.cashCloses.create(data)
      await audit("Caixa aberto", turn.id); return turn
    }
    if (kind === "cash-movement") {
      demand("cash.move")
      const input = z.object({ direction: z.enum(["supply", "withdraw"]), value: money.refine(v => v > 0), accountId: z.string().min(1), reason }).strict().parse(payload)
      if (!active) throw Error("Abra o caixa antes de movimentar dinheiro")
      const incoming = input.direction === "supply", description = `Caixa ${input.reason}`
      const previous = entries.find(e => e.originId === requestId && e.accountId)
      if (previous) {
        if (previous.value !== input.value || previous.accountId !== input.accountId || previous.description !== description || previous.type !== (incoming ? "transferencia_saida" : "transferencia_entrada")) throw Error("Confirmação reutilizada com dados diferentes")
        return { success: true }
      }
      const account = (await staged.bankAccounts.getAll()).find(a => a.id === input.accountId && a.active)
      if (!account) throw Error("Selecione uma conta ativa")
      if (incoming ? cents(account.currentBalance) < cents(input.value) : cents(totals(active).expectedValue) < cents(input.value)) throw Error("Saldo insuficiente")
      await staged.bankAccounts.update(account.id, { currentBalance: (cents(account.currentBalance) + cents(input.value) * (incoming ? -1 : 1)) / 100 })
      const common = { date: now, description, refId: description, value: input.value, responsible: actor.username, originType: "cash-movement", originId: requestId, batchId: requestId }
      await staged.transactions.create({ ...common, type: incoming ? "transferencia_saida" : "transferencia_entrada", paymentMethod: "PIX", accountId: account.id })
      await staged.transactions.create({ ...common, type: incoming ? "transferencia_entrada" : "transferencia_saida", paymentMethod: "Dinheiro", cashSessionId: active.id })
      await audit(incoming ? "Suprimento de caixa" : "Sangria de caixa", active.id); return { success: true }
    }
    const input = z.object({ sessionId: z.string().min(1), physicalValue: money.optional(), retainedValue: money.optional(), withdrawalAccountId: z.string().min(1).optional(), closingReason: reason.optional(), note: reason.optional() }).strict().parse(payload)
    const turn = turns.find(t => t.id === input.sessionId)
    if (!turn) throw Error("Turno não encontrado")
    if (kind === "cash-inspect") { demand("cashCloses.read"); return { ...turn, ...totals(turn), expectedValue: turn.status === "fechado" ? turn.expectedValue : totals(turn).expectedValue } }
    if (kind === "cash-review") {
      demand("cash.review")
      if (turn.status !== "fechado" || !turn.divergence || !input.note) throw Error("Informe a conferência de um fechamento com diferença")
      if (turn.reviewedAt) throw Error("Esta diferença já foi conferida")
      const reviewed = await staged.cashCloses.update(turn.id, { reviewedAt: now, reviewedBy: actor.username, reviewNote: input.note })
      await audit("Diferença de caixa conferida", turn.id); return reviewed
    }
    demand("cash.close")
    if (turn.responsibleUserId !== actor.id && !can("cash.closeAny")) throw Error("Somente o responsável ou supervisor pode fechar este caixa")
    const physicalValue = money.parse(input.physicalValue), retainedValue = input.retainedValue ?? physicalValue
    if (retainedValue > physicalValue) throw Error("O fundo não pode exceder o dinheiro contado")
    if (turn.status !== "aberto") throw Error("Caixa já fechado")
    const values = totals(turn), divergence = (cents(physicalValue) - cents(values.expectedValue)) / 100, withdrawnValue = (cents(physicalValue) - cents(retainedValue)) / 100
    if (divergence && !input.closingReason) throw new ApiError(`Há diferença no caixa. Esperado: R$ ${values.expectedValue.toFixed(2)}. Contado: R$ ${physicalValue.toFixed(2)}. Diferença: R$ ${divergence.toFixed(2)}. Reconte ou informe uma justificativa.`, 409, "CASH_DIFFERENCE")
    if (input.withdrawalAccountId) {
      demand("cash.move")
      const account = (await staged.bankAccounts.getAll()).find(a => a.id === input.withdrawalAccountId && a.active)
      if (!account || withdrawnValue <= 0) throw Error("Confira a conta e o valor do depósito")
      await staged.bankAccounts.update(account.id, { currentBalance: (cents(account.currentBalance) + cents(withdrawnValue)) / 100 })
      await staged.transactions.create({ date: now, description: `Depósito do fechamento ${turn.id}`, refId: `Depósito do fechamento ${turn.id}`, value: withdrawnValue, type: "transferencia_entrada", paymentMethod: "PIX", accountId: account.id, responsible: actor.username, originType: "cash-closing-deposit", originId: turn.id })
    }
    const closed = await staged.cashCloses.update(turn.id, { status: "fechado", date: now, closedAt: now, closedBy: actor.username, physicalValue, expectedValue: values.expectedValue, divergence, retainedValue, withdrawnValue, closingReason: input.closingReason, withdrawalAccountId: input.withdrawalAccountId })
    await audit("Caixa fechado", turn.id); return { ...closed, ...values }
  })
}
