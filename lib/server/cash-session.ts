import type { Prisma } from "@prisma/client"
import { HttpError } from "./http"

export const CLOSED_CASH = "Caixa fechado — abra para vender ou lançar bebidas na hospedagem"

/** All writers and closing lock the same row, inside the serializable command. */
export async function touchOpenCash(tx: Prisma.TransactionClient, required = false) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM cash_closes WHERE status = 'aberto' FOR UPDATE`
  if (!rows[0]) {
    if (required) throw new HttpError(409, CLOSED_CASH)
    return undefined
  }
  return tx.cashClose.update({ where: { id: rows[0].id }, data: { recordVersion: { increment: 1 } } })
}
