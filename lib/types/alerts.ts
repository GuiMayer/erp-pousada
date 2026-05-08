/**
 * Alert System Types
 * 
 * Defines types for the business rules alert system
 */

export type AlertType = 'info' | 'warning' | 'error' | 'success'
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Alert {
  id: string
  type: AlertType
  priority: AlertPriority
  title: string
  message: string
  timestamp: string
  dismissed: boolean
  actionLabel?: string
  onAction?: () => void
}

export interface AlertRule {
  id: string
  name: string
  enabled: boolean
  condition: (context: any) => boolean
  threshold?: number
  message: string
  type: AlertType
  priority: AlertPriority
}

export interface AlertThresholds {
  // Stock thresholds
  stockCriticalLevel: number // percentage of minimum stock
  stockLowLevel: number // percentage of minimum stock
  
  // Cash register thresholds
  cashDifferenceWarning: number // R$ amount
  cashDifferenceCritical: number // R$ amount
  withdrawalApprovalRequired: number // R$ amount
  
  // Order thresholds
  openOrderWarningHours: number // hours
  openOrderCriticalHours: number // hours
  
  // Payment thresholds
  cashPaymentWarning: number // R$ amount
  changeMaximum: number // R$ amount
  
  // Production thresholds
  yieldWarningPercentage: number // percentage
  yieldCriticalPercentage: number // percentage
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  // Stock
  stockCriticalLevel: 100, // at or below minimum
  stockLowLevel: 150, // 1.5x minimum
  
  // Cash
  cashDifferenceWarning: 50,
  cashDifferenceCritical: 100,
  withdrawalApprovalRequired: 500,
  
  // Orders
  openOrderWarningHours: 3,
  openOrderCriticalHours: 4,
  
  // Payment
  cashPaymentWarning: 200,
  changeMaximum: 50,
  
  // Production
  yieldWarningPercentage: 90,
  yieldCriticalPercentage: 80,
}
