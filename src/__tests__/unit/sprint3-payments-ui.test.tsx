import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PaymentDialog } from '@/components/payment-fields'
import { POSCheckoutDialog } from '@/components/pos-checkout-dialog'
import { BatchReceiptsPanel } from '@/components/batch-receipts-panel'

const state = vi.hoisted(() => ({runOperation:vi.fn(),stays:[{id:'stay',status:'active',recordVersion:3,roomId:1,guestName:'Ana'}],bankAccounts:[{id:'bank',active:true,name:'Conta A'}],rooms:[{id:1,number:'1'}],accountsReceivable:[{id:'a',description:'Título A',customerName:'Empresa',value:600,paidValue:100,status:'pendente',recordVersion:4},{id:'b',description:'Título B',customerName:'Empresa',value:600,paidValue:0,status:'pendente',recordVersion:7}]}))
vi.mock('@/lib/app-context',()=>({useApp:()=>state}))
vi.mock('@/lib/auth-context',()=>({useAuth:()=>({can:()=>true})}))
describe('Controles de pagamento da Sprint 3',()=>{
  beforeEach(()=>{state.runOperation.mockReset();state.stays[0].recordVersion=3})
  it('trocar crédito pessoal por pagamento misto não envia ordem de consumir crédito',async()=>{
    const confirm=vi.fn()
    render(<PaymentDialog open title="Receber" maximum={100} mixedEnabled allowCredit onClose={vi.fn()} onConfirm={confirm}/> )
    fireEvent.change(screen.getByLabelText('Forma de pagamento'),{target:{value:'credito_hospede'}})
    fireEvent.click(screen.getByText('Dividir entre formas de pagamento'))
    fireEvent.click(screen.getByText('Confirmar pagamento'))
    await waitFor(()=>expect(confirm).toHaveBeenCalledWith('pix',undefined,100,[{method:'pix',value:100,accountId:undefined}]))
  })
  it('divide PIX 40 e dinheiro 70, mostra troco 10 e preserva o formulário em falha',async()=>{
    const confirm=vi.fn().mockRejectedValue(Error('Conflito: revise o saldo'))
    render(<PaymentDialog open title="Receber" maximum={100} mixedEnabled onClose={vi.fn()} onConfirm={confirm}/> )
    fireEvent.click(screen.getByText('Dividir entre formas de pagamento'))
    fireEvent.change(screen.getByLabelText('Valor do pagamento 1'),{target:{value:'40'}})
    fireEvent.click(screen.getByText('Adicionar forma de pagamento'))
    fireEvent.change(screen.getByLabelText('Meio do pagamento 2'),{target:{value:'dinheiro'}})
    fireEvent.change(screen.getByLabelText('Valor do pagamento 2'),{target:{value:'70'}})
    expect(screen.getByRole('status')).toHaveTextContent(/Troco em dinheiro:.*10,00/)
    fireEvent.click(screen.getByText('Confirmar pagamento'))
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Conflito'))
    expect(confirm).toHaveBeenCalledWith('pix',undefined,100,[{method:'pix',value:40,accountId:undefined},{method:'dinheiro',value:70,accountId:undefined}])
    expect(screen.getByLabelText('Valor do pagamento 2')).toHaveValue(70)
  })
  it('a cobrança na hospedagem preserva a versão selecionada e não envia recebimento',async()=>{
    const confirm=vi.fn().mockRejectedValue(Error('Hospedagem alterada'))
    const view=render(<POSCheckoutDialog total={12} onClose={vi.fn()} onConfirm={confirm}/>)
    fireEvent.change(screen.getByLabelText('Como cobrar'),{target:{value:'stay'}})
    fireEvent.change(screen.getByLabelText('Hospedagem para cobrança'),{target:{value:'stay'}})
    state.stays[0].recordVersion=4
    view.rerender(<POSCheckoutDialog total={12} onClose={vi.fn()} onConfirm={confirm}/>)
    fireEvent.click(screen.getByRole('button',{name:'Lançar na hospedagem'}))
    await waitFor(()=>expect(confirm).toHaveBeenCalledWith({stayId:'stay',stayVersion:3}))
    expect(screen.getByRole('alert')).toHaveTextContent('Hospedagem alterada')
  })
  it('distribui um recebimento entre dois títulos com suas versões e total fixo',async()=>{
    render(<BatchReceiptsPanel/>)
    for(const checkbox of screen.getAllByRole('checkbox'))fireEvent.click(checkbox)
    fireEvent.change(screen.getByLabelText('Receber de Título A'),{target:{value:'250'}})
    fireEvent.change(screen.getByLabelText('Receber de Título B'),{target:{value:'250'}})
    fireEvent.click(screen.getByRole('button',{name:'Receber R$ 500.00'}))
    expect(screen.getByLabelText('Valor a receber')).toBeDisabled()
    fireEvent.click(screen.getByText('Confirmar pagamento'))
    await waitFor(()=>expect(state.runOperation).toHaveBeenCalledWith('receive-batch',expect.objectContaining({targets:[{accountReceivableId:'a',recordVersion:4,value:250,installmentId:undefined},{accountReceivableId:'b',recordVersion:7,value:250,installmentId:undefined}]})))
  })
})
