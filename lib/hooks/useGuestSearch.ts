import { useState, useCallback } from "react"
import type { GuestProfile } from "../store"
import { validateCPF } from "../utils/validators"

/**
 * Hook for searching guests by CPF
 */
export function useGuestSearch(findGuest: (cpf: string) => GuestProfile | undefined) {
  const [cpf, setCpf] = useState("")
  const [guestName, setGuestName] = useState("")
  const [foundGuest, setFoundGuest] = useState<GuestProfile | undefined>()

  const handleCpfChange = useCallback((value: string) => {
    setCpf(value)
    
    // Auto-search when CPF has enough digits
    if (value.replace(/\D/g, "").length >= 11) {
      const guest = findGuest(value)
      setFoundGuest(guest)
      if (guest) {
        setGuestName(guest.name)
      }
    } else {
      setFoundGuest(undefined)
    }
  }, [findGuest])

  const reset = useCallback(() => {
    setCpf("")
    setGuestName("")
    setFoundGuest(undefined)
  }, [])

  const isValidCPF = validateCPF(cpf)

  return {
    cpf,
    setCpf: handleCpfChange,
    guestName,
    setGuestName,
    foundGuest,
    isValidCPF,
    isNewGuest: !foundGuest && isValidCPF,
    reset,
  }
}
