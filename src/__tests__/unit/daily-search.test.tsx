import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CustomerCombobox } from '@/components/customer-combobox'
import { AccountsReceivableManagement } from '@/components/accounts-receivable-management'
import { businessDay } from '@/lib/utils/business-values'
const people = [{id:'9f56a062-18d3-4c0d-957b-a8e0bdfb204a',name:'Mária Exemplo',cpfCnpj:'52998224725',phone:'(41) 99876-5432',active:true,roles:['guest','payer']}]
vi.mock('@/lib/app-context',()=>({useApp:()=>({customers:people,addCustomer:vi.fn(),stays:[],transactions:[],accountsReceivable:[{id:'title',customerName:'Empresa Alfa',customerId:people[0].id,description:'Estadia outubro',value:200,dueDate:businessDay(),status:'pendente'}]})}))
vi.mock('@/lib/auth-context',()=>({useAuth:()=>({can:()=>true})}))
vi.mock('@/lib/data/config',()=>({getDataConfig:()=>({adapter:'database'})}))
vi.mock('@/components/stay-sheet',()=>({StayButton:()=>null}))
vi.mock('@/components/batch-receipts-panel',()=>({BatchReceiptsPanel:()=> <div>Recebimento em lote</div>}))
beforeEach(()=>{vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})))})
afterEach(()=>vi.unstubAllGlobals())
describe('Busca no atendimento diário',()=>{
 it.each(['Maria','529.982.247-25','99876'])('busca pessoa por %s e permite selecionar a identidade',async query=>{
  const select=vi.fn();render(<CustomerCombobox purpose="guest" onChange={select}/>);
  fireEvent.click(screen.getByRole('combobox'));fireEvent.change(await screen.findByPlaceholderText('Buscar cliente...'),{target:{value:query}});
  fireEvent.click(await screen.findByText('Mária Exemplo'));
  expect(select).toHaveBeenCalledWith(people[0].id,people[0].name,people[0]);
 });
 it('resultado vazio mantém criação rápida disponível',async()=>{
  render(<CustomerCombobox onChange={()=>{}}/>);fireEvent.click(screen.getByRole('combobox'));fireEvent.change(await screen.findByPlaceholderText('Buscar cliente...'),{target:{value:'Inexistente'}});
  await screen.findByText('Nenhum cliente encontrado.');expect(screen.getByText('Criar novo cliente')).toBeVisible();
 });
 it('cobrança de hoje não é atraso, busca filtra e existe somente um recebimento em lote',async()=>{
  render(<AccountsReceivableManagement/>);
  expect(screen.getAllByText('Recebimento em lote')).toHaveLength(1);
  expect(screen.getByText('Estadia outubro').closest('tr')?.className).not.toContain('bg-red-50');
  fireEvent.change(screen.getByLabelText('Buscar cobrança'),{target:{value:'não existe'}});
  await waitFor(()=>expect(screen.queryByText('Estadia outubro')).toBeNull());
  fireEvent.change(screen.getByLabelText('Buscar cobrança'),{target:{value:'Alfa'}});expect(screen.getByText('Estadia outubro')).toBeTruthy();
 });
})
