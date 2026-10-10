import { normalizePayment } from './utils/business-values'
export type PaymentLine = { method: string; value: number; accountId?: string }
export function distributePayment(total: number, lines: PaymentLine[]) {
  const cents = (value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > 999999999 || Math.abs(value*100-Math.round(value*100))>.00001) throw Error('Use valores válidos com até duas casas decimais')
    return Math.round(value*100)
  }
  const owed=cents(total)
  if (!lines.length || lines.length>8) throw Error('Informe de uma a oito formas de pagamento')
  const normalized=lines.map(p=>({...p,method:normalizePayment(p.method),value:cents(p.value)}))
  if (owed === 0 && normalized.length === 1 && normalized[0].method === 'Dinheiro' && normalized[0].value === 0 && !normalized[0].accountId) return {offered:0,change:0,lines:[{...normalized[0],applied:0}]}
  if(normalized.some(p=>!['Dinheiro','PIX','Cartao Debito','Cartao Credito'].includes(p.method)||p.value<=0)) throw Error('Forma ou valor de pagamento inválido')
  if(normalized.filter(p=>p.method==='Dinheiro').length>1) throw Error('Informe dinheiro em uma única linha')
  if(normalized.some(p=>p.method==='Dinheiro'&&p.accountId)) throw Error('Dinheiro utiliza o caixa físico')
  const digital=normalized.filter(p=>p.method!=='Dinheiro').reduce((v,p)=>v+p.value,0)
  const offered=normalized.reduce((v,p)=>v+p.value,0)
  if(digital>owed) throw Error('PIX/cartão não pode exceder o valor a quitar; troco somente em dinheiro')
  if(offered<owed) throw Error('Pagamento insuficiente')
  const change=offered-owed
  return { offered:offered/100,change:change/100,lines:normalized.map(p=>({...p,value:p.value/100,applied:(p.value-(p.method==='Dinheiro'?change:0))/100})) }
}
export const cashIncoming = (type: string) => ['receita','transferencia_entrada'].includes(type)
