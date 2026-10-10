"use client"
import { useState } from 'react'
import { useApp } from '@/lib/app-context'
import { useAuth } from '@/lib/auth-context'
import type { Transaction } from '@/lib/store'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function TransactionCheck({transaction,onDone}:{transaction:Transaction;onDone:()=>void}) {
  const {runOperation}=useApp(),{can}=useAuth()
  const [note,setNote]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('')
  async function submit(){if(pending)return;setPending(true);setError('');try{await runOperation('check-transaction',{transactionId:transaction.id,checked:!transaction.checkedAt,note});onDone()}catch(e){setError((e as Error).message)}finally{setPending(false)}}
  return <div className="grid gap-3 rounded border p-3 text-sm">
    {transaction.originType&&<p>Origem: {transaction.originType} · {transaction.originId}</p>}
    {transaction.batchId&&<p className="break-all">Grupo de pagamento: {transaction.batchId}</p>}
    {transaction.reversalOfId&&<p className="break-all">Estorno de: {transaction.reversalOfId}</p>}
    {transaction.allocations?.map(a=><p key={a.id} className="break-all">{a.targetType} · {a.targetId}: R$ {a.value.toFixed(2)}</p>)}
    {transaction.accountId&&<><p>{transaction.checkedAt?'Conferido manualmente':'Ainda não conferido no extrato bancário'}{transaction.checkNote&&`: ${transaction.checkNote}`}</p>{can('transactions.check')&&<><Input aria-label="Justificativa da conferência" placeholder="Justificativa (mínimo 5 caracteres)" value={note} disabled={pending} onChange={e=>setNote(e.target.value)}/><Button disabled={pending||note.trim().length<5} onClick={submit}>{pending?'Registrando…':transaction.checkedAt?'Desmarcar conferência':'Marcar como conferido'}</Button></>}</>}
    {error&&<p role="alert" className="text-destructive">{error}</p>}
  </div>
}
