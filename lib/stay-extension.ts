import { z } from "zod";
import type { LodgingQuote } from "./lodging-pricing";

export const extensionInput = z
  .object({
    stayId: z.string().min(1).max(200),
    recordVersion: z.number().int().nonnegative(),
    checkOut: z.string().date(),
    reason: z
      .string()
      .trim()
      .min(5, "Informe o motivo com pelo menos cinco caracteres")
      .max(500),
    quotedTotal: z.number().finite().positive().max(999999999),
    quoteSignature: z.string().min(1).max(65536),
    confirmed: z.literal(true),
  })
  .strict();

// Compare the exact nights and tariff versions reviewed by the user, not just their sum.
export function extensionQuoteSignature(quote: LodgingQuote) {
  return JSON.stringify(
    quote.nights.map((n) => [
      n.date,
      n.guests,
      n.pricePerPerson,
      n.total,
      n.tariffId ?? null,
      n.tariffVersion ?? 0,
    ]),
  );
}
export function extensionDateError(
  previous: string,
  next: string,
  today: string,
) {
  if (
    !z.string().date().safeParse(next).success ||
    next <= previous ||
    next <= today
  )
    return "A nova saída deve ser posterior à saída atual e a hoje.";
  return undefined;
}
