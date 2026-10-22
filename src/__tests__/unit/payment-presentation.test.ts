import { expect, it } from "vitest"
import { paymentChartData } from "@/lib/reports/payment-presentation"
it("agrupa nomes equivalentes sem perder valores e mantém cores distintas", () => {
 const items = paymentChartData([{method:"Débito",revenue:10,count:1},{method:"Cartao Debito",revenue:20,count:2},{method:"Cartão de crédito",revenue:30,count:1}])
 expect(items.find(i=>i.id==="debit")).toMatchObject({revenue:30,count:3,percentage:50})
 expect(items.find(i=>i.id==="credit")).toMatchObject({revenue:30,percentage:50})
 expect(items.find(i=>i.id==="debit")!.color).not.toBe(items.find(i=>i.id==="credit")!.color)
 expect(items.find(i=>i.id==="pix")!.revenue).toBe(0)
})
it("representa ausência sem NaN e identifica vendas na hospedagem", () => {
 expect(paymentChartData([]).every(item=>item.percentage===0)).toBe(true)
 expect(paymentChartData([{method:"Na hospedagem",revenue:25,count:1}]).find(i=>i.id==="stay")).toMatchObject({revenue:25,percentage:100})
})
