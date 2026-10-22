import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ConsumptionSheet } from '@/components/consumption-sheet'
const app=vi.hoisted(()=>({addConsumptionItem:vi.fn(),removeConsumptionItem:vi.fn(),addAuditEntry:vi.fn(),runOperation:vi.fn(),getConsumption:vi.fn(),getCategoryName:()=> 'Bebidas',posProducts:[{id:'water',name:'Água',price:5,active:true,categoryId:'drinks'}],productCategories:[{id:'drinks',name:'Bebidas',isRestaurant:false}],stays:[{id:'first',status:'active',roomId:1,recordVersion:3}],bankAccounts:[],cashCloses:[] as {id:string;status:string}[],denied:[] as string[]}))
vi.mock('@/lib/app-context',()=>({useApp:()=>app}))
vi.mock('@/lib/auth-context',()=>({useAuth:()=>({can:(p:string)=>!app.denied.includes(p),canRequest:()=>true,username:'Operador'})}))
vi.mock('@/lib/notification-context',()=>({useNotifications:()=>({sendNotification:vi.fn()})}))
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}))
const room={id:1,number:'101',type:'casal',status:'ocupado' as const,guest:'Primeiro hóspede',timeline:[]}
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER','database');app.addConsumptionItem.mockReset();app.runOperation.mockReset();app.getConsumption.mockReturnValue(undefined);app.cashCloses=[];app.denied=[];app.stays=[{id:'first',status:'active',roomId:1,recordVersion:3}]})
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


describe('Consumo com caixa fechado',()=>{
 it('avisa ao abrir sem impedir o lançamento na ficha e mantém os campos após abrir o caixa',async()=>{
  app.runOperation.mockImplementation(async()=>{app.cashCloses=[{id:'turn',status:'aberto'}]})
  const view=render(<ConsumptionSheet room={room} open onClose={()=>{}}/>);
  expect(screen.getByText(/Caixa fechado. Você pode lançar/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Quantidade por entrega'),{target:{value:'3'}});
  expect(screen.getByText('Água').closest('button')).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Abrir caixa'}));
  fireEvent.click(within(screen.getByRole('dialog',{name:'Abrir caixa'})).getByRole('button',{name:'Abrir caixa'}));
  await waitFor(()=>expect(app.runOperation).toHaveBeenCalledWith('cash-open',{openingValue:0}));
  view.rerender(<ConsumptionSheet room={room} open onClose={()=>{}}/>);
  await waitFor(()=>expect(screen.queryByText(/Caixa fechado. Você pode lançar/)).not.toBeInTheDocument());
  expect(screen.getByLabelText('Quantidade por entrega')).toHaveValue(3);
  expect(screen.getByRole('dialog',{name:'Consumo - Quarto 101'})).toBeInTheDocument();
  expect(app.runOperation).toHaveBeenCalledWith('cash-open',{openingValue:0});
 });
 it('bloqueia apenas a quitação em dinheiro e mantém PIX disponível',()=>{
  app.getConsumption.mockReturnValue({roomId:1,items:[{id:'item',label:'Água',unitPrice:5,quantity:1}]});
  render(<ConsumptionSheet room={room} open onClose={()=>{}}/>);
  expect(screen.getByRole('button',{name:'Quitar consumo'})).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Forma de pagamento'),{target:{value:'dinheiro'}});
  expect(screen.getByRole('button',{name:'Quitar consumo'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Quitar consumo'}));
  expect(app.runOperation).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Forma de pagamento'),{target:{value:'pix'}});
  expect(screen.getByRole('button',{name:'Quitar consumo'})).toBeEnabled();
 });
 it('orienta pedir abertura a outro usuário quando não há permissão',()=>{
  app.denied=['cash.open'];
  render(<ConsumptionSheet room={room} open onClose={()=>{}}/>);
  expect(screen.queryByRole('button',{name:'Abrir caixa'})).not.toBeInTheDocument();
  expect(screen.getByText(/Peça a um usuário autorizado/)).toBeInTheDocument();
  expect(screen.getByText('Água').closest('button')).toBeEnabled();
 });
})
