import { describe,it,expect } from 'vitest'
import {distributePayment,cashIncoming} from '@/lib/payments'
describe('Liquidação e troco',()=>{
  it('cortesia não cria valor recebido e linha zero não quita dívida positiva',()=>{
    expect(distributePayment(0,[{method:'dinheiro',value:0}])).toMatchObject({offered:0,change:0,lines:[{applied:0}]})
    expect(()=>distributePayment(10,[{method:'dinheiro',value:0}])).toThrow()
  })
  it('AP-15: PIX 40 + dinheiro 70 aplica 100 e devolve 10 do dinheiro',()=>{
    const result=distributePayment(100,[{method:'pix',value:40,accountId:'bank'},{method:'dinheiro',value:70}])
    expect(result.change).toBe(10);expect(result.lines.map(p=>p.applied)).toEqual([40,60])
  })
  it('recusa excesso digital mesmo quando há dinheiro na composição',()=>expect(()=>distributePayment(100,[{method:'pix',value:110},{method:'dinheiro',value:10}])).toThrow('PIX/cartão'))
  it('recusa insuficiência e centavos inválidos',()=>{expect(()=>distributePayment(100,[{method:'pix',value:99}])).toThrow('insuficiente');expect(()=>distributePayment(1,[{method:'pix',value:1.001}])).toThrow('decimais')})
  it('mantém centavos exatos e não atribui troco ao cartão',()=>{
    expect(distributePayment(.3,[{method:'pix',value:.1},{method:'debito',value:.2}]).change).toBe(0)
    expect(()=>distributePayment(10,[{method:'credito',value:11}])).toThrow('troco')
  })
  it('dinheiro não possui conta bancária nem duas linhas',()=>{expect(()=>distributePayment(10,[{method:'dinheiro',value:10,accountId:'bank'}])).toThrow('caixa');expect(()=>distributePayment(10,[{method:'dinheiro',value:5},{method:'dinheiro',value:5}])).toThrow('única')})
  it('suprimento aumenta o caixa e transferências não são receita',()=>{expect(cashIncoming('transferencia_entrada')).toBe(true);expect(cashIncoming('transferencia_saida')).toBe(false)})
})
