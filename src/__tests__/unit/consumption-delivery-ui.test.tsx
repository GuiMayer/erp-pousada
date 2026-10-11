import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConsumptionSheet } from '@/components/consumption-sheet'
const app=vi.hoisted(()=>({addConsumptionItem:vi.fn(),removeConsumptionItem:vi.fn(),addAuditEntry:vi.fn(),runOperation:vi.fn(),getConsumption:()=>undefined,getCategoryName:()=> 'Bebidas',posProducts:[{id:'water',name:'Água',price:5,active:true,categoryId:'drinks'}],productCategories:[{id:'drinks',name:'Bebidas',isRestaurant:false}],stays:[{id:'first',status:'active',roomId:1,recordVersion:3}],bankAccounts:[]}))
vi.mock('@/lib/app-context',()=>({useApp:()=>app}))
vi.mock('@/lib/auth-context',()=>({useAuth:()=>({can:()=>true,username:'Operador'})}))
vi.mock('@/lib/notification-context',()=>({useNotifications:()=>({sendNotification:vi.fn()})}))
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}))
const room={id:1,number:'101',type:'casal',status:'ocupado' as const,guest:'Primeiro hóspede',timeline:[]}
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER','database');app.addConsumptionItem.mockReset();app.stays=[{id:'first',status:'active',roomId:1,recordVersion:3}]})
describe('Entrega de bebida no atendimento',()=>{
 it('envia três unidades numa entrega e bloqueia toque repetido até a resposta',async()=>{
  let finish!:()=>void;app.addConsumptionItem.mockReturnValue(new Promise<void>(resolve=>{finish=resolve}))
  render(<ConsumptionSheet room={room} open onClose={()=>{}}/>);
  fireEvent.change(screen.getByLabelText('Quantidade por entrega'),{target:{value:'3'}});
  const product=screen.getByText('Água').closest('button')!;fireEvent.click(product);fireEvent.click(product);
  expect(app.addConsumptionItem).toHaveBeenCalledOnce();expect(app.addConsumptionItem).toHaveBeenCalledWith(1,expect.objectContaining({productId:'water',quantity:3}),'first');expect(product).toBeDisabled();
  finish();await waitFor(()=>expect(product).toBeEnabled());
 });
 it('não substitui a identidade esperada pelo próximo hóspede enquanto a tela está aberta',async()=>{
  app.addConsumptionItem.mockResolvedValue(undefined)
  const view=render(<ConsumptionSheet room={room} open onClose={()=>{}}/>);
  app.stays=[{id:'next',status:'active',roomId:1,recordVersion:1}];view.rerender(<ConsumptionSheet room={{...room,guest:'Próximo hóspede'}} open onClose={()=>{}}/>);
  expect(screen.getByText('Água').closest('button')).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('hospedagem mudou');
  fireEvent.click(screen.getByText('Água').closest('button')!);expect(app.addConsumptionItem).not.toHaveBeenCalled();
 });
})
