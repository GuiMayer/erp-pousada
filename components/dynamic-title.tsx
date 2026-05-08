"use client"

import { useEffect } from "react"
import { useApp } from "@/lib/app-context"

export function DynamicTitle() {
  const { systemSettings } = useApp()

  useEffect(() => {
    document.title = `${systemSettings.pousadaName} - Painel de Quartos`
  }, [systemSettings.pousadaName])

  return null
}
