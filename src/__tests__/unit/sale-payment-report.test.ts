import { describe, it, expect } from "vitest"
import { salePaymentBreakdown, totalSalesByMethod } from "@/lib/reports/sale-payments"
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/formatters"
import type { POSSale } from "@/lib/store"
const sale: POSSale = { id: "sale", date: "2026-10-22", items: [], subtotal: 100, discount: 0, total: 100, paymentMethod: "misto", amountPaid: 110, change: 10, operator: "Ana", status: "concluida", payments: [{ method: "pix", value: 40 }, { method: "dinheiro", value: 70 }] }
describe("Composição de cobrança sem contar troco ou dívida como recebimento", () => {
  it("separa PIX 40 e dinheiro líquido 60, excluindo o troco de 10", () => {
    expect(salePaymentBreakdown(sale)).toEqual([{ method: "PIX", value: 40 }, { method: "Dinheiro", value: 60 }])
    expect(totalSalesByMethod([sale], "Dinheiro")).toBe(60)
  })
  it("identifica a venda na hospedagem sem atribuí-la a dinheiro ou PIX", () => {
    const deferred = { ...sale, stayId: "stay", amountPaid: 0, change: 0, payments: undefined }
    expect(salePaymentBreakdown(deferred)).toEqual([{ method: "Na hospedagem", value: 100 }])
    expect(totalSalesByMethod([sale, deferred], "Dinheiro")).toBe(60)
  })
  it("usa vírgula decimal, separador de milhar e sinal coerente sem alterar números", () => {
    expect(formatCurrency(-1234.56)).toBe("-R$ 1.234,56")
    expect(formatNumber(1234.5)).toBe("1.234,50")
    expect(formatPercent(36.7)).toBe("36,7%")
  })
})
