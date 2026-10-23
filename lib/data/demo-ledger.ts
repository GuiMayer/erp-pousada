import type { Transaction } from "@/lib/store"
import type { DataStore } from "./types"
import { normalizePayment } from "@/lib/utils/business-values"
import { acceptsPayment, isCardPayment } from "@/lib/payment-accounts"
import { touchDemoCash } from "./demo-cash-session"
import { cashIncoming } from "@/lib/payments"

/** Called only inside withDemoTransaction: receipt and balance commit together. */
export async function demoLedger(store: DataStore, entry: Omit<Transaction, "id"> & { id?: string }) {
  const method = normalizePayment(entry.paymentMethod ?? "")
  const turn = method ? await touchDemoCash(store, method === "Dinheiro") : undefined
  let accountId = entry.accountId
  const incoming = cashIncoming(entry.type)
  if (method === "Dinheiro") {
    if (accountId) throw Error("Dinheiro utiliza a gaveta")
    const available = Math.round((turn!.openingValue ?? 0) * 100) + (await store.transactions.getAll()).filter(t => t.cashSessionId === turn!.id).reduce((n, t) => n + Math.round(t.value * 100) * (cashIncoming(t.type) ? 1 : -1), 0)
    if (!incoming && available < Math.round(entry.value * 100)) throw Error("Saldo de caixa insuficiente")
  } else if (method) {
    let accounts = (await store.bankAccounts.getAll()).filter(a => acceptsPayment(a, method))
    if (isCardPayment(method) && !accounts.length && !accountId) {
      const account = await store.bankAccounts.create({ name: "Cartões a receber", type: "cartao", active: true, initialBalance: 0, currentBalance: 0 })
      accounts = [account]
    }
    const account = accounts.find(a => a.id === accountId) ?? (!accountId && accounts.length === 1 ? accounts[0] : undefined)
    if (!account) throw Error("Selecione uma conta ativa adequada ao pagamento")
    if (!incoming && Math.round(account.currentBalance * 100) < Math.round(entry.value * 100)) throw Error("Saldo insuficiente; confira os repasses e a conta da devolução")
    accountId = account.id
    await store.bankAccounts.update(account.id, { currentBalance: (Math.round(account.currentBalance * 100) + Math.round(entry.value * 100) * (incoming ? 1 : -1)) / 100, recordVersion: (account.recordVersion ?? 0) + 1 })
  }
  return store.transactions.create({ ...entry, paymentMethod: method || undefined, accountId, cashSessionId: method === "Dinheiro" ? turn!.id : undefined, operationalSessionId: turn?.id })
}
