// Operational status does not grant access to balances or past closings.
export function canReadCashStatus(can: (permission: string) => boolean) {
  return ["cash.open", "cash.close", "cash.move", "cashCloses.read", "cash.review", "pos.sell", "hospitality.receive", "consumptions.receive", "accountsReceivable.receive", "expenses.pay", "reservations.cancel", "pos.refund", "transactions.refund"].some(can)
}
