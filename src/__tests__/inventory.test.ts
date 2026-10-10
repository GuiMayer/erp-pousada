import {describe,it,expect} from 'vitest'
import {receiptTotals,lotUsable,type ReceiptLine} from '@/lib/inventory'
const line=(overrides:Partial<ReceiptLine>={}):ReceiptLine=>({productId:'water',packaging:'Fardo',factor:12,acceptedPackages:2,refusedPackages:1,packagePrice:60,code:'ABC',...overrides})
describe('Rateio de recebimento',()=>{
 it('converte somente embalagens aceitas e reconcilia custo',()=>{expect(receiptTotals([line()])).toEqual({subtotal:120,total:120,lines:[{quantity:24,goodsTotal:120,totalCost:120}]})})
 it('distribui centavos sem perda inclusive frete maior que mercadoria',()=>{const rows=[line({packagePrice:.01,acceptedPackages:1}),line({packagePrice:.02,acceptedPackages:1})];for(let cents=0;cents<100;cents++){const result=receiptTotals(rows,cents/100,0);expect(result.lines.reduce((s,l)=>s+Math.round(l.totalCost*100),0)).toBe(3+cents)}})
 it('rejeita fator/quantidade imprecisos, desconto excessivo e recebimento vazio',()=>{for(const rows of [[line({factor:1.0001})],[line({acceptedPackages:1.5})],[line({acceptedPackages:0})]])expect(()=>receiptTotals(rows)).toThrow();expect(()=>receiptTotals([line()],0,121)).toThrow()})
 it('compra gratuita não inventa custo; frete de cortesia usa quantidade',()=>{expect(receiptTotals([line({packagePrice:0})]).total).toBe(0);expect(receiptTotals([line({packagePrice:0})],10).lines[0].totalCost).toBe(10)})
 it('saldo físico vencido, bloqueado ou sem revisão não é utilizável',()=>{const today='2026-10-10';expect(lotUsable({status:'active',expiresAt:today},today,true)).toBe(true);expect(lotUsable({status:'active',expiresAt:null},today,true)).toBe(false);expect(lotUsable({status:'unverified',expiresAt:today},today)).toBe(false);expect(lotUsable({status:'active',expiresAt:'2026-10-09'},today)).toBe(false)})
})
