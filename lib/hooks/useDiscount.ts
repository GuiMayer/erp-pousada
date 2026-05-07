import { useState, useCallback } from "react"
import { validateDiscount, requiresSupervisorApproval, validateSupervisorPassword } from "../utils/validators"

/**
 * Hook for managing discount validation and supervisor approval
 */
export function useDiscount(discountCeiling: number) {
  const [discountValue, setDiscountValue] = useState(0)
  const [supervisorPassword, setSupervisorPassword] = useState("")
  const [isApproved, setIsApproved] = useState(false)

  const needsApproval = requiresSupervisorApproval(discountValue, discountCeiling)
  const isValid = validateDiscount(discountValue, discountCeiling) || (needsApproval && isApproved)

  const handleDiscountChange = useCallback((value: number) => {
    setDiscountValue(value)
    // Reset approval if discount changes
    if (isApproved && !requiresSupervisorApproval(value, discountCeiling)) {
      setIsApproved(false)
      setSupervisorPassword("")
    }
  }, [discountCeiling, isApproved])

  const handleSupervisorApproval = useCallback((password: string) => {
    setSupervisorPassword(password)
    if (validateSupervisorPassword(password)) {
      setIsApproved(true)
      return true
    }
    return false
  }, [])

  const reset = useCallback(() => {
    setDiscountValue(0)
    setSupervisorPassword("")
    setIsApproved(false)
  }, [])

  return {
    discountValue,
    setDiscountValue: handleDiscountChange,
    supervisorPassword,
    setSupervisorPassword,
    needsApproval,
    isApproved,
    isValid,
    handleSupervisorApproval,
    reset,
  }
}
