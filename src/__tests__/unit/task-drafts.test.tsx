import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TaskDraftProvider, useTaskState, useTaskRef } from '@/contexts/task-drafts-context'
import { useState } from 'react'
function Task(){const [value,setValue]=useTaskState('form','');const [count,setCount]=useTaskState('count',0);const ref=useTaskRef('id','original');const [label,setLabel]=useState('');return <><input aria-label="Rascunho" value={value} onChange={e=>setValue(e.target.value)}/><button onClick={()=>{setCount(n=>n+1);ref.current='pedido'}}>{count}</button><button onClick={()=>setLabel(ref.current)}>Ver pedido</button><output>{label}</output></>}
function Harness(){const [show,setShow]=useState(true),[user,setUser]=useState('a');return <><button onClick={()=>setShow(!show)}>Outra aba</button><button onClick={()=>setUser('b')}>Trocar usuário</button><TaskDraftProvider key={user}>{show&&<Task/>}</TaskDraftProvider></>}
describe('Rascunhos em memória por sessão',()=>{
 it('conserva formulário e identidade do pedido ao desmontar; troca de usuário limpa ambos',()=>{
  render(<Harness/>);fireEvent.change(screen.getByLabelText('Rascunho'),{target:{value:'reserva'}});fireEvent.click(screen.getByRole('button',{name:'0'}));
  fireEvent.click(screen.getByText('Outra aba'));expect(screen.queryByLabelText('Rascunho')).toBeNull();fireEvent.click(screen.getByText('Outra aba'));
  expect(screen.getByLabelText('Rascunho')).toHaveValue('reserva');expect(screen.getByRole('button',{name:'1'})).toBeTruthy();fireEvent.click(screen.getByText('Ver pedido'));expect(screen.getByText('pedido')).toBeTruthy();
  fireEvent.click(screen.getByText('Trocar usuário'));expect(screen.getByLabelText('Rascunho')).toHaveValue('');expect(screen.getByRole('button',{name:'0'})).toBeTruthy();
 });
 it('permite várias atualizações funcionais sem perder quantidade e não escreve localStorage',()=>{
  render(<TaskDraftProvider><Task/></TaskDraftProvider>);fireEvent.click(screen.getByRole('button',{name:'0'}));fireEvent.click(screen.getByRole('button',{name:'1'}));expect(screen.getByRole('button',{name:'2'})).toBeTruthy();expect(localStorage.length).toBe(0);
 });
})
