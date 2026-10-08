import { getDataConfig } from "../data/config"
import { useState, useCallback } from "react"
import { validateDiscount, requiresSupervisorApproval, validateSupervisorPasswordAsync } from "../utils/validators"

/**
 * Hook for managing discount validation and supervisor approval
 */
export function useDiscount(discountCeiling: number) {
  const [discountValue, setDiscountValue] = useState(0)
  const [supervisorPassword, setSupervisorPassword] = useState("")
  const [isApproved, setIsApproved] = useState(false)

  const needsApproval = getDataConfig().adapter === "demo-localStorage" && requiresSupervisorApproval(discountValue, discountCeiling)
  const isValid = getDataConfig().adapter === "database" || validateDiscount(discountValue, discountCeiling) || (needsApproval && isApproved)

  const handleDiscountChange = useCallback((value: number) => {
    setDiscountValue(value)
    // Reset approval if discount changes
    if (isApproved && !requiresSupervisorApproval(value, discountCeiling)) {
      setIsApproved(false)
      setSupervisorPassword("")
    }
  }, [discountCeiling, isApproved])

  const handleSupervisorApproval = useCallback(async (password: string) => {
    setSupervisorPassword(password)
    if (await validateSupervisorPasswordAsync(password)) {
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
