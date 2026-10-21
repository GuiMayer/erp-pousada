import { describe, it, expect, vi } from 'vitest'
import { expectedRoomStay } from '@/lib/server/stays'
describe('Identidade da hospedagem no consumo',()=>{
 it.each([null,{id:'previous',roomId:1,status:'closed'},{id:'previous',roomId:2,status:'active'}])('recusa hospedagem ausente, encerrada ou transferida',async row=>{
  const findUnique=vi.fn().mockResolvedValue(row)
  await expect(expectedRoomStay({stay:{findUnique}} as never,1,'previous')).rejects.toMatchObject({status:409})
  expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{id:'previous'}}))
 });
 it('não procura o próximo hóspede quando a hospedagem esperada encerrou',async()=>{
  const findUnique=vi.fn().mockResolvedValue({id:'previous',roomId:1,status:'closed'}),findFirst=vi.fn().mockResolvedValue({id:'next',roomId:1,status:'active'})
  await expect(expectedRoomStay({stay:{findUnique,findFirst}} as never,1,'previous')).rejects.toThrow('hospedagem deste atendimento mudou')
  expect(findFirst).not.toHaveBeenCalled()
 });
 it('retorna exclusivamente a hospedagem ativa selecionada',async()=>{
  const row={id:'expected',roomId:1,status:'active'}
  expect(await expectedRoomStay({stay:{findUnique:vi.fn().mockResolvedValue(row)}} as never,1,'expected')).toBe(row)
 });
})
