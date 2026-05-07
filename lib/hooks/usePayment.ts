import { useState, useCallback, useMemo } from "react"
import { validatePaymentAmount } from "../utils/validators"

/**
 * Hook for managing payment flow and calculations
 */
export function usePayment(total: number) {
  const [paymentMethod, setPaymentMethod] = useState("dinheiro")
  const [amountPaid, setAmountPaid] = useState("")

  const amountPaidNumber = useMemo(() => {
    const parsed = parseFloat(amountPaid)
    return isNaN(parsed) ? 0 : parsed
  }, [amountPaid])

  const change = useMemo(() => {
    return Math.max(0, amountPaidNumber - total)
  }, [amountPaidNumber, total])

  const isValidPayment = useMemo(() => {
    return validatePaymentAmount(amountPaidNumber, total)
  }, [amountPaidNumber, total])

  const reset = useCallback(() => {
    setPaymentMethod("dinheiro")
    setAmountPaid("")
  }, [])

  const setAmountToTotal = useCallback(() => {
    setAmountPaid(total.toFixed(2))
  }, [total])

  return {
    paymentMethod,
    setPaymentMethod,
    amountPaid,
    setAmountPaid,
    amountPaidNumber,
    change,
    isValidPayment,
    reset,
    setAmountToTotal,
  }
}
