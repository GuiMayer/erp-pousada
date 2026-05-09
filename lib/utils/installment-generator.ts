import type { ExpenseInstallment } from "@/lib/store"
import { generateExpenseInstallmentId } from "@/lib/utils/id-generators"

export interface InstallmentGeneratorOptions {
  totalValue: number
  numberOfInstallments: number
  firstDueDate: string
  intervalDays?: number // Default: 30 days
}

/**
 * Generates installments for an expense
 * @param options Configuration for installment generation
 * @returns Array of ExpenseInstallment objects
 */
export function generateInstallments(
  options: InstallmentGeneratorOptions
): ExpenseInstallment[] {
  const { totalValue, numberOfInstallments, firstDueDate, intervalDays = 30 } = options

  if (numberOfInstallments <= 0) {
    throw new Error("Number of installments must be greater than 0")
  }

  if (totalValue <= 0) {
    throw new Error("Total value must be greater than 0")
  }

  // Calculate base value per installment
  const baseValue = Math.floor((totalValue * 100) / numberOfInstallments) / 100
  
  // Calculate remainder to distribute among first installments
  const remainder = Math.round((totalValue - baseValue * numberOfInstallments) * 100) / 100

  const installments: ExpenseInstallment[] = []
  const firstDate = new Date(firstDueDate + "T12:00:00")

  for (let i = 0; i < numberOfInstallments; i++) {
    // Add remainder to first installment to ensure total matches exactly
    const installmentValue = i === 0 ? baseValue + remainder : baseValue

    // Calculate due date for this installment
    const dueDate = new Date(firstDate)
    dueDate.setDate(dueDate.getDate() + i * intervalDays)
    const dueDateStr = dueDate.toISOString().split("T")[0]

    installments.push({
      id: generateExpenseInstallmentId(),
      installmentNumber: i + 1,
      value: installmentValue,
      dueDate: dueDateStr,
      paid: false,
    })
  }

  return installments
}

/**
 * Calculates the total value of installments
 */
export function calculateInstallmentsTotal(installments: ExpenseInstallment[]): number {
  return installments.reduce((sum, inst) => sum + inst.value, 0)
}

/**
 * Calculates how many installments are paid
 */
export function countPaidInstallments(installments: ExpenseInstallment[]): number {
  return installments.filter(inst => inst.paid).length
}

/**
 * Calculates the total value of paid installments
 */
export function calculatePaidInstallmentsTotal(installments: ExpenseInstallment[]): number {
  return installments.filter(inst => inst.paid).reduce((sum, inst) => sum + inst.value, 0)
}

/**
 * Checks if all installments are paid
 */
export function areAllInstallmentsPaid(installments: ExpenseInstallment[]): boolean {
  return installments.length > 0 && installments.every(inst => inst.paid)
}

/**
 * Gets the next unpaid installment
 */
export function getNextUnpaidInstallment(
  installments: ExpenseInstallment[]
): ExpenseInstallment | null {
  return installments.find(inst => !inst.paid) || null
}

/**
 * Checks if any installment is overdue
 */
export function hasOverdueInstallments(installments: ExpenseInstallment[]): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return installments.some(inst => {
    if (inst.paid) return false
    const dueDate = new Date(inst.dueDate + "T12:00:00")
    dueDate.setHours(0, 0, 0, 0)
    return dueDate < today
  })
}
