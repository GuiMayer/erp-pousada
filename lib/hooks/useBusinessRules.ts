import { useCallback } from "react"
import { useAlerts } from "../alert-context"
import type { StockItem, RestaurantOrder, CashClose } from "../store"

/**
 * Hook for business rules validation and alerts
 * 
 * Provides functions to check business rules and trigger alerts
 * when thresholds are exceeded
 */
export function useBusinessRules() {
  const { addAlert, thresholds } = useAlerts()

  /**
   * Check stock level and alert if below threshold
   */
  const checkStockLevel = useCallback((item: StockItem) => {
    const { stockCriticalLevel, stockLowLevel } = thresholds

    // Critical: at or below minimum stock
    if (item.currentStock <= item.minimumStock * (stockCriticalLevel / 100)) {
      addAlert({
        type: 'error',
        priority: 'critical',
        title: 'Estoque Crítico',
        message: `${item.productName}: ${item.currentStock} ${item.unit} (mínimo: ${item.minimumStock})`,
      })
      return 'critical'
    }

    // Low: below 1.5x minimum stock
    if (item.currentStock <= item.minimumStock * (stockLowLevel / 100)) {
      addAlert({
        type: 'warning',
        priority: 'high',
        title: 'Estoque Baixo',
        message: `${item.productName}: ${item.currentStock} ${item.unit} (mínimo: ${item.minimumStock})`,
      })
      return 'low'
    }

    return 'ok'
  }, [addAlert, thresholds])

  /**
   * Check cash register difference and alert if above threshold
   */
  const checkCashDifference = useCallback((cashClose: CashClose) => {
    const { cashDifferenceWarning, cashDifferenceCritical } = thresholds

    const totalDifference = Math.abs(
      (cashClose.cashDifference || 0) +
      (cashClose.debitDifference || 0) +
      (cashClose.creditDifference || 0) +
      (cashClose.pixDifference || 0)
    )

    if (totalDifference >= cashDifferenceCritical) {
      addAlert({
        type: 'error',
        priority: 'critical',
        title: 'Divergência Crítica no Caixa',
        message: `Diferença total de R$ ${totalDifference.toFixed(2)}. Verifique imediatamente!`,
      })
      return 'critical'
    }

    if (totalDifference >= cashDifferenceWarning) {
      addAlert({
        type: 'warning',
        priority: 'high',
        title: 'Divergência no Caixa',
        message: `Diferença total de R$ ${totalDifference.toFixed(2)}. Recomenda-se verificação.`,
      })
      return 'warning'
    }

    return 'ok'
  }, [addAlert, thresholds])

  /**
   * Check withdrawal amount and alert if approval required
   */
  const checkWithdrawalAmount = useCallback((amount: number) => {
    const { withdrawalApprovalRequired } = thresholds

    if (amount >= withdrawalApprovalRequired) {
      addAlert({
        type: 'warning',
        priority: 'high',
        title: 'Sangria Requer Aprovação',
        message: `Sangria de R$ ${amount.toFixed(2)} requer aprovação de supervisor.`,
      })
      return true
    }

    return false
  }, [addAlert, thresholds])

  /**
   * Check open order time and alert if too long
   */
  const checkOpenOrderTime = useCallback((order: RestaurantOrder) => {
    if (order.status !== 'aberta') return 'ok'

    const { openOrderWarningHours, openOrderCriticalHours } = thresholds
    const openedAt = new Date(order.openedAt).getTime()
    const now = Date.now()
    const hoursOpen = (now - openedAt) / (1000 * 60 * 60)

    if (hoursOpen >= openOrderCriticalHours) {
      addAlert({
        type: 'error',
        priority: 'critical',
        title: 'Comanda Aberta Há Muito Tempo',
        message: `Mesa ${order.tableNumber || order.id}: aberta há ${hoursOpen.toFixed(1)}h`,
      })
      return 'critical'
    }

    if (hoursOpen >= openOrderWarningHours) {
      addAlert({
        type: 'warning',
        priority: 'medium',
        title: 'Comanda Aberta',
        message: `Mesa ${order.tableNumber || order.id}: aberta há ${hoursOpen.toFixed(1)}h`,
      })
      return 'warning'
    }

    return 'ok'
  }, [addAlert, thresholds])

  /**
   * Check cash payment amount and alert if high
   */
  const checkCashPayment = useCallback((amount: number) => {
    const { cashPaymentWarning } = thresholds

    if (amount >= cashPaymentWarning) {
      addAlert({
        type: 'info',
        priority: 'low',
        title: 'Pagamento Alto em Dinheiro',
        message: `Pagamento de R$ ${amount.toFixed(2)} em dinheiro. Verifique troco disponível.`,
      })
      return true
    }

    return false
  }, [addAlert, thresholds])

  /**
   * Check change amount and alert if exceeds maximum
   */
  const checkChangeAmount = useCallback((change: number) => {
    const { changeMaximum } = thresholds

    if (change > changeMaximum) {
      addAlert({
        type: 'warning',
        priority: 'medium',
        title: 'Troco Excede Limite',
        message: `Troco de R$ ${change.toFixed(2)} excede o máximo recomendado de R$ ${changeMaximum.toFixed(2)}.`,
      })
      return true
    }

    return false
  }, [addAlert, thresholds])

  /**
   * Check production yield and alert if below threshold
   */
  const checkProductionYield = useCallback((
    plannedQuantity: number,
    producedQuantity: number,
    recipeName: string
  ) => {
    const { yieldWarningPercentage, yieldCriticalPercentage } = thresholds
    const yieldPercentage = (producedQuantity / plannedQuantity) * 100

    if (yieldPercentage < yieldCriticalPercentage) {
      addAlert({
        type: 'error',
        priority: 'high',
        title: 'Rendimento Crítico',
        message: `${recipeName}: ${yieldPercentage.toFixed(1)}% de rendimento (esperado: ${yieldCriticalPercentage}%+)`,
      })
      return 'critical'
    }

    if (yieldPercentage < yieldWarningPercentage) {
      addAlert({
        type: 'warning',
        priority: 'medium',
        title: 'Rendimento Baixo',
        message: `${recipeName}: ${yieldPercentage.toFixed(1)}% de rendimento (esperado: ${yieldWarningPercentage}%+)`,
      })
      return 'warning'
    }

    return 'ok'
  }, [addAlert, thresholds])

  return {
    checkStockLevel,
    checkCashDifference,
    checkWithdrawalAmount,
    checkOpenOrderTime,
    checkCashPayment,
    checkChangeAmount,
    checkProductionYield,
  }
}
