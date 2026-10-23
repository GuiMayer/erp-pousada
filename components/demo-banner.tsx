"use client"
import { useState } from "react"
import { X } from "lucide-react"

export function DemoBanner() {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return <div role="status" className="fixed inset-x-0 top-0 z-40 border-b border-amber-300 bg-amber-100 pt-[env(safe-area-inset-top)] text-amber-950 shadow-sm">
    <div className="relative flex min-h-11 items-center py-2 pl-4 pr-14">
      <p className="w-full text-center text-xs font-medium sm:text-sm">Demonstração · Dados fictícios. Ambiente de testes, separado dos dados operacionais.</p>
      <button type="button" aria-label="Fechar aviso de demonstração" onClick={() => setVisible(false)} className="absolute top-0 right-1 flex size-11 items-center justify-center rounded-md hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-amber-950"><X aria-hidden="true" className="size-4" /></button>
    </div>
  </div>
}
