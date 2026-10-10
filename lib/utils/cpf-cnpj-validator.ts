/**
 * CPF/CNPJ Validator
 * 
 * Utilities for validating and formatting Brazilian CPF and CNPJ documents
 */

/**
 * Remove non-numeric characters from a string
 */
export function normalizeDocument(value: string): string {
  return value.toUpperCase().replace(/[.\/\-\s]/g, '')
}
const cleanDocument = normalizeDocument

/**
 * Check if a value is a CPF (11 digits)
 */
export function isCPF(value: string): boolean {
  const cleaned = cleanDocument(value)
  return /^\d{11}$/.test(cleaned)
}

/**
 * Check if a value is a CNPJ (14 digits)
 */
export function isCNPJ(value: string): boolean {
  const cleaned = cleanDocument(value)
  return /^[A-Z0-9]{12}\d{2}$/.test(cleaned)
}

/**
 * Validate CPF using check digits algorithm
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = cleanDocument(cpf)
  
  if (!/^\d{11}$/.test(cleaned)) {
    return false
  }
  
  // Check for known invalid CPFs (all digits the same)
  if (/^(\d)\1{10}$/.test(cleaned)) {
    return false
  }
  
  // Validate first check digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i)
  }
  let checkDigit = 11 - (sum % 11)
  if (checkDigit >= 10) checkDigit = 0
  if (checkDigit !== parseInt(cleaned.charAt(9))) {
    return false
  }
  
  // Validate second check digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i)
  }
  checkDigit = 11 - (sum % 11)
  if (checkDigit >= 10) checkDigit = 0
  if (checkDigit !== parseInt(cleaned.charAt(10))) {
    return false
  }
  
  return true
}

/**
 * Validate CNPJ using check digits algorithm
 */
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cleanDocument(cnpj)
  
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cleaned)) {
    return false
  }
  
  // Check for known invalid CNPJs (all digits the same)
  if (/^(\d)\1{13}$/.test(cleaned)) {
    return false
  }
  
  // Validate first check digit
  let sum = 0
  let weight = 5
  for (let i = 0; i < 12; i++) {
    sum += (cleaned.charCodeAt(i) - 48) * weight
    weight = weight === 2 ? 9 : weight - 1
  }
  let checkDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (checkDigit !== parseInt(cleaned.charAt(12))) {
    return false
  }
  
  // Validate second check digit
  sum = 0
  weight = 6
  for (let i = 0; i < 13; i++) {
    sum += (cleaned.charCodeAt(i) - 48) * weight
    weight = weight === 2 ? 9 : weight - 1
  }
  checkDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (checkDigit !== parseInt(cleaned.charAt(13))) {
    return false
  }
  
  return true
}

/**
 * Validate CPF or CNPJ automatically based on length
 */
export function validateCpfCnpj(value: string): boolean {
  const cleaned = cleanDocument(value)
  
  if (cleaned.length === 11) {
    return validateCPF(cleaned)
  } else if (cleaned.length === 14) {
    return validateCNPJ(cleaned)
  }
  
  return false
}

/**
 * Format CPF as 000.000.000-00
 */
export function formatCPF(cpf: string): string {
  const cleaned = cleanDocument(cpf)
  
  if (cleaned.length !== 11) {
    return cpf
  }
  
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/**
 * Format CNPJ as 00.000.000/0000-00
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = cleanDocument(cnpj)
  
  if (cleaned.length !== 14) {
    return cnpj
  }
  
  return cleaned.replace(/([A-Z0-9]{2})([A-Z0-9]{3})([A-Z0-9]{3})([A-Z0-9]{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

/**
 * Format CPF or CNPJ automatically based on length
 */
export function formatCpfCnpj(value: string): string {
  const cleaned = cleanDocument(value)
  
  if (cleaned.length === 11) {
    return formatCPF(cleaned)
  } else if (cleaned.length === 14) {
    return formatCNPJ(cleaned)
  }
  
  return value
}

/**
 * Get document type label
 */
export function getDocumentType(value: string): 'CPF' | 'CNPJ' | 'Inválido' {
  const cleaned = cleanDocument(value)
  
  if (cleaned.length === 11) {
    return 'CPF'
  } else if (cleaned.length === 14) {
    return 'CNPJ'
  }
  
  return 'Inválido'
}
