export const isCardPayment = (method: string) => /^(debito|credito|cart[aã]o d[eé]bito|cart[aã]o cr[eé]dito)$/i.test(method)
export const acceptsPayment = (account: { active: boolean; type: string }, method: string) => account.active && (isCardPayment(method) ? account.type === "cartao" : account.type !== "cartao" && account.type !== "caixa")

export function cardPayoutAmounts(gross: number, fee: number) {
  if (![gross, fee].every(n => Number.isFinite(n) && n >= 0 && n <= 999999999 && Math.abs(n * 100 - Math.round(n * 100)) < .00001) || gross <= 0 || fee > gross) throw Error("Confira o valor bruto e a taxa do repasse")
  return { gross, fee, net: (Math.round(gross * 100) - Math.round(fee * 100)) / 100 }
}
