import { describe, expect, it } from "vitest"
import { stayBalance, type Stay } from "@/lib/stays"
const base: Stay={id:'stay',reservationId:'r',guestName:'Hóspede',roomId:1,checkIn:'2026-10-10',checkOut:'2026-10-12',status:'active',recordVersion:0,lodgingValue:400,occupants:[],allocations:[],charges:[{id:'c',label:'Bebida',unitPrice:12,quantity:2,status:'active',createdAt:''}],payments:[{id:'p',value:100,bucket:'lodging',method:'pix',createdAt:''}]}
describe('Extrato da hospedagem',()=>{
  it('reconcilia diárias, bebidas, sinal e saldo em centavos',()=>expect(stayBalance(base)).toEqual({total:424,consumption:24,paid:100,balance:324,lodgingBalance:300,consumptionBalance:24}))
  it('recebimento parcial depois da saída conserva a mesma conta',()=>expect(stayBalance({...base,status:'closed',payments:[...base.payments,{id:'p2',value:100,bucket:'lodging',method:'pix',createdAt:''}]}).balance).toBe(224))
  it('conserva a linha corrigida, mas retira seu valor da cobrança',()=>expect(stayBalance({...base,charges:base.charges.map(c=>({...c,status:'corrected'}))})).toMatchObject({total:400,consumption:0,balance:300}))
  it('opera valores fracionários sem erro de soma',()=>expect(stayBalance({...base,lodgingValue:.1,charges:[{...base.charges[0],unitPrice:.2,quantity:1}],payments:[]}).total).toBe(.3))
})
