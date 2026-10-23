import { summarizeCash } from "@/lib/cash-summary"
import { acceptsPayment } from "@/lib/payment-accounts"
import { formatCurrency } from "@/lib/utils/formatters"
import { z } from "zod"
import type { DataStore } from "./types"
import type { CashClose } from "@/lib/store"
import { withDemoTransaction } from "./demo-transaction"
import { cashIncoming } from "@/lib/payments"
import { ApiError } from "./conflicts"

const money = z.number().finite().nonnegative().max(999999999).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < .00001)
const reason = z.string().trim().min(5).max(500)
const cents = (value: number) => Math.round(value * 100)
export const demoCashKinds = ["cash-open", "cash-close", "cash-preview", "cash-movement", "cash-review", "cash-inspect"]
export function demoCashOperation(store: DataStore, kind: string, payload: unknown, can: (p: string) => boolean, actor: { id: string; username: string }, requestId: string) {
  return withDemoTransaction(store, async staged => {
    const demand = (permission: string) => { if (!can(permission)) throw Error("Você não tem permissão para esta ação") }
    const turns = await staged.cashCloses.getAll(), entries = await staged.transactions.getAll(), now = new Date().toISOString()
    const active = turns.find(t => t.status === "aberto")
    const charges = (await staged.stays.getAll()).flatMap(s => s.charges)
    const summary = (turn: CashClose) => summarizeCash(turn, entries, charges)
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
      const data: CashClose = { id: requestId, status: "aberto", recordVersion: 0, date: now, openedAt: now, operator: actor.username, responsibleUserId: actor.id, openingValue: input.openingValue, openingReason: input.openingReason, previousSessionId: previous?.id, expectedValue: input.openingValue, physicalValue: 0, divergence: 0 }
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
      const account = (await staged.bankAccounts.getAll()).find(a => a.id === input.accountId && acceptsPayment(a, "PIX"))
      if (!account) throw Error("Selecione uma conta ativa")
      if (incoming ? cents(account.currentBalance) < cents(input.value) : cents(totals(active).expectedValue) < cents(input.value)) throw Error("Saldo insuficiente")
      await staged.bankAccounts.update(account.id, { currentBalance: (cents(account.currentBalance) + cents(input.value) * (incoming ? -1 : 1)) / 100 })
      const common = { date: now, description, refId: description, value: input.value, responsible: actor.username, originType: "cash-movement", originId: requestId, batchId: requestId }
      await staged.transactions.create({ ...common, type: incoming ? "transferencia_saida" : "transferencia_entrada", paymentMethod: "PIX", accountId: account.id })
      await staged.transactions.create({ ...common, type: incoming ? "transferencia_entrada" : "transferencia_saida", paymentMethod: "Dinheiro", cashSessionId: active.id })
      await staged.cashCloses.update(active.id, { recordVersion: (active.recordVersion ?? 0) + 1 })
      await audit(incoming ? "Suprimento de caixa" : "Sangria de caixa", active.id); return { success: true }
    }
    const input = z.object({ sessionId: z.string().min(1), recordVersion: z.number().int().nonnegative().optional(), physicalValue: money.optional(), retainedValue: money.optional(), withdrawalAccountId: z.string().min(1).optional(), closingReason: reason.optional(), note: reason.optional() }).strict().parse(payload)
    const turn = turns.find(t => t.id === input.sessionId)
    if (!turn) throw Error("Turno não encontrado")
    if (kind === "cash-inspect") { demand("cashCloses.read"); return { ...turn, ...totals(turn), expectedValue: turn.status === "fechado" ? turn.expectedValue : totals(turn).expectedValue, closingSummary: turn.status === "fechado" ? turn.closingSummary : summary(turn) } }
    if (kind === "cash-review") {
      demand("cash.review")
      if (turn.status !== "fechado" || !turn.divergence || !input.note) throw Error("Informe a conferência de um fechamento com diferença")
      if (turn.reviewedAt) throw Error("Esta diferença já foi conferida")
      const reviewed = await staged.cashCloses.update(turn.id, { reviewedAt: now, reviewedBy: actor.username, reviewNote: input.note })
      await audit("Diferença de caixa conferida", turn.id); return reviewed
    }
    demand("cash.close")
    if (turn.responsibleUserId !== actor.id && !can("cash.closeAny")) throw Error("Somente o responsável ou supervisor pode fechar este caixa")
    if (kind === "cash-preview") {
      if (turn.status !== "aberto") throw Error("Caixa já fechado")
      return { ...turn, recordVersion: turn.recordVersion ?? 0, closingSummary: summary(turn) }
    }
    const receipt = (await staged.auditLog.getAll()).find(a => a.action === "Caixa fechado" && a.metadata?.requestId === requestId)
    if (receipt) {
      if (JSON.stringify(receipt.metadata?.payload) !== JSON.stringify(payload)) throw Error("Confirmação reutilizada com dados diferentes")
      return { ...turn, ...totals(turn) }
    }
    if (turn.status !== "aberto") throw Error("Caixa já fechado")
    if (input.recordVersion !== (turn.recordVersion ?? 0)) throw new ApiError("O caixa mudou durante a conferência. Confira o resumo atualizado antes de fechar.", 409, "CASH_CHANGED")
    const physicalValue = money.parse(input.physicalValue), retainedValue = input.retainedValue ?? physicalValue
    if (retainedValue > physicalValue) throw Error("O fundo não pode exceder o dinheiro contado")
    if (turn.status !== "aberto") throw Error("Caixa já fechado")
    const values = totals(turn), divergence = (cents(physicalValue) - cents(values.expectedValue)) / 100, withdrawnValue = (cents(physicalValue) - cents(retainedValue)) / 100
    if (divergence && !input.closingReason) throw new ApiError(`Há diferença no caixa. Esperado: ${formatCurrency(values.expectedValue)}. Contado: ${formatCurrency(physicalValue)}. Diferença: ${formatCurrency(Number(divergence))}. Reconte ou informe uma justificativa.`, 409, "CASH_DIFFERENCE")
    if (input.withdrawalAccountId) {
      demand("cash.move")
      const account = (await staged.bankAccounts.getAll()).find(a => a.id === input.withdrawalAccountId && acceptsPayment(a, "PIX"))
      if (!account || withdrawnValue <= 0) throw Error("Confira a conta e o valor do depósito")
      await staged.bankAccounts.update(account.id, { currentBalance: (cents(account.currentBalance) + cents(withdrawnValue)) / 100 })
      await staged.transactions.create({ date: now, description: `Depósito do fechamento ${turn.id}`, refId: `Depósito do fechamento ${turn.id}`, value: withdrawnValue, type: "transferencia_entrada", paymentMethod: "PIX", accountId: account.id, responsible: actor.username, originType: "cash-closing-deposit", originId: turn.id })
    }
    const closed = await staged.cashCloses.update(turn.id, { recordVersion: (turn.recordVersion ?? 0) + 1, closingSummary: summary(turn), status: "fechado", date: now, closedAt: now, closedBy: actor.username, physicalValue, expectedValue: values.expectedValue, divergence, retainedValue, withdrawnValue, closingReason: input.closingReason, withdrawalAccountId: input.withdrawalAccountId })
    await staged.auditLog.create({ date: now, user: actor.username, action: "Caixa fechado", reference: turn.id, entityType: "cashCloses", entityId: turn.id, operation: "update", metadata: { requestId, payload } }); return { ...closed, ...values }
  })
}
