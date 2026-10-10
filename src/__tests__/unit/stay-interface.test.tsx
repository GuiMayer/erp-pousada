import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { StaySheet } from '@/components/stay-sheet'
import type { Stay } from '@/lib/stays'
const {runOperation,can}=vi.hoisted(()=>({runOperation:vi.fn(),can:vi.fn(()=>true)}))
vi.mock('@/lib/auth-context',()=>({useAuth:()=>({can})}))
vi.mock('@/lib/app-context',()=>({useApp:()=>({runOperation,rooms:[{id:1,number:'101',status:'ocupado',capacity:2},{id:2,number:'102',status:'disponivel',capacity:2}],customers:[{id:'company',name:'Empresa Exemplo',active:true,cpfCnpj:'12ABC34501DE35',roles:['payer']}],lodgingTariffs:[],accountsReceivable:[],bankAccounts:[]})}))
const stay:Stay={id:'s',reservationId:'r',payerId:'company',guestName:'Pessoa Exemplo',guestCount:2,roomId:1,status:'active',recordVersion:7,checkIn:'2026-10-10',checkOut:'2026-10-12',lodgingValue:400,occupants:[{id:'o',name:'Pessoa Exemplo'}],allocations:[{id:'a',roomId:1,start:'2026-10-10',end:'2026-10-12'}],charges:[{id:'c',label:'Água',unitPrice:12,quantity:2,status:'active',createdAt:''}],payments:[{id:'p',value:100,bucket:'lodging',method:'pix',createdAt:''}]}
beforeEach(()=>{cleanup();runOperation.mockReset();runOperation.mockResolvedValue({success:true});can.mockImplementation(()=>true)})
describe('Extrato e saída da hospedagem',()=>{
  it('mostra saldo 324 e histórico sem duplicar o sinal',()=>{
    render(<StaySheet stay={stay} onClose={()=>{}}/>);
    expect(screen.getByText(/Saldo a receber:/).textContent).toContain('324,00');expect(screen.getByText('Consumo preservado')).toBeTruthy();expect(screen.getByText(/Pagador:/).textContent).toContain('Empresa Exemplo')
  })
  it('exige vencimento e confirmação antes de solicitar saída com a versão aberta',async()=>{
    render(<StaySheet stay={stay} onClose={()=>{}}/>);
    const button=screen.getByRole('button',{name:'Encerrar com cobrança empresarial'});
    expect(button).toBeDisabled();fireEvent.change(screen.getByLabelText('Vencimento'),{target:{value:'2099-01-01'}});fireEvent.click(screen.getByLabelText('Confirmo a saída e a cobrança da empresa'));fireEvent.click(button);
    await waitFor(()=>expect(runOperation).toHaveBeenCalledWith('stay-checkout',{stayId:'s',recordVersion:7,dueDate:'2099-01-01',confirmed:true}))
  })
  it('mantém ocupantes editados visíveis quando o servidor recusa versão antiga',async()=>{
    runOperation.mockRejectedValue(new Error('Registro alterado em outro dispositivo'));
    render(<StaySheet stay={stay} onClose={()=>{}}/>);
    fireEvent.change(screen.getByLabelText('Nome do ocupante 2'),{target:{value:'Acompanhante'}});fireEvent.click(screen.getByRole('button',{name:'Salvar ocupantes'}));
    await screen.findByRole('alert');expect(screen.getByLabelText('Nome do ocupante 2')).toHaveValue('Acompanhante')
  })
  it('recepção sem autorização não recebe a ação de saída empresarial',()=>{
    can.mockImplementation((permission?:string)=>permission!=='hospitality.companyCredit');
    render(<StaySheet stay={stay} onClose={()=>{}}/>);
    expect(screen.queryByRole('button',{name:'Encerrar com cobrança empresarial'})).toBeNull();expect(screen.getByText(/Quite o saldo antes da saída/)).toBeTruthy()
  })
})
