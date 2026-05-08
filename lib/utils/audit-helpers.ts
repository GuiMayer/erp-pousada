/**
 * Audit Helpers
 * 
 * Utility functions for creating detailed audit entries with state tracking,
 * diff calculation, and sensitive data sanitization.
 */

import type { AuditEntry } from "../store"

/**
 * Parameters for creating a detailed audit entry
 */
export interface DetailedAuditParams {
  user: string
  action: string
  reference: string
  entityType?: string
  entityId?: string | number
  operation?: "create" | "update" | "delete" | "action"
  before?: any
  after?: any
  metadata?: Record<string, any>
}

/**
 * Result of a state diff comparison
 */
export interface StateDiff {
  changed: string[]
  added: string[]
  removed: string[]
  diff: Record<string, { before: any; after: any }>
}

/**
 * Fields that should be sanitized from audit logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'creditCard',
  'credit_card',
  'cvv',
  'pin'
]

/**
 * Create a detailed audit entry with optional state tracking
 */
export function createDetailedAuditEntry(params: DetailedAuditParams): Omit<AuditEntry, "id" | "date"> {
  const {
    user,
    action,
    reference,
    entityType,
    entityId,
    operation,
    before,
    after,
    metadata = {}
  } = params

  // Sanitize before/after if provided
  const sanitizedBefore = before ? sanitizeForAudit(before) : undefined
  const sanitizedAfter = after ? sanitizeForAudit(after) : undefined

  // Build metadata object
  const auditMetadata: Record<string, any> = {
    ...metadata
  }

  if (sanitizedBefore !== undefined) {
    auditMetadata.before = sanitizedBefore
  }

  if (sanitizedAfter !== undefined) {
    auditMetadata.after = sanitizedAfter
  }

  // Create the audit entry
  const entry: Omit<AuditEntry, "id" | "date"> = {
    user,
    action,
    reference,
    entityType,
    entityId,
    operation,
    metadata: Object.keys(auditMetadata).length > 0 ? auditMetadata : undefined
  }

  return entry
}

/**
 * Capture the differences between two objects
 */
export function captureStateDiff(before: any, after: any): StateDiff {
  const result: StateDiff = {
    changed: [],
    added: [],
    removed: [],
    diff: {}
  }

  // Handle null/undefined cases
  if (!before && !after) return result
  if (!before) {
    // Everything in after is added
    if (typeof after === 'object' && after !== null) {
      result.added = Object.keys(after)
    }
    return result
  }
  if (!after) {
    // Everything in before is removed
    if (typeof before === 'object' && before !== null) {
      result.removed = Object.keys(before)
    }
    return result
  }

  // Handle non-object types
  if (typeof before !== 'object' || typeof after !== 'object') {
    if (before !== after) {
      result.changed = ['value']
      result.diff['value'] = { before, after }
    }
    return result
  }

  // Get all keys from both objects
  const beforeKeys = new Set(Object.keys(before))
  const afterKeys = new Set(Object.keys(after))
  const allKeys = new Set([...beforeKeys, ...afterKeys])

  // Compare each key
  for (const key of allKeys) {
    const hasInBefore = beforeKeys.has(key)
    const hasInAfter = afterKeys.has(key)

    if (!hasInBefore && hasInAfter) {
      // Key was added
      result.added.push(key)
    } else if (hasInBefore && !hasInAfter) {
      // Key was removed
      result.removed.push(key)
    } else {
      // Key exists in both - check if value changed
      const beforeValue = before[key]
      const afterValue = after[key]

      if (!deepEqual(beforeValue, afterValue)) {
        result.changed.push(key)
        result.diff[key] = {
          before: beforeValue,
          after: afterValue
        }
      }
    }
  }

  return result
}

/**
 * Sanitize sensitive data from objects before logging
 */
export function sanitizeForAudit(data: any, maxDepth: number = 5): any {
  // Prevent infinite recursion
  if (maxDepth <= 0) return '[Max depth reached]'

  // Handle null/undefined
  if (data === null || data === undefined) return data

  // Handle primitives
  if (typeof data !== 'object') return data

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForAudit(item, maxDepth - 1))
  }

  // Handle dates
  if (data instanceof Date) return data.toISOString()

  // Handle objects
  const sanitized: Record<string, any> = {}

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()

    // Check if this is a sensitive field
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]'
      continue
    }

    // Special handling for CPF - mask partially
    if (lowerKey === 'cpf' && typeof value === 'string') {
      sanitized[key] = maskCPF(value)
      continue
    }

    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForAudit(value, maxDepth - 1)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Mask CPF showing only last 3 digits
 */
function maskCPF(cpf: string): string {
  if (!cpf || cpf.length < 3) return '***'
  const lastThree = cpf.slice(-3)
  return `***.***.***-${lastThree}`
}

/**
 * Deep equality check for comparing values
 */
function deepEqual(a: any, b: any): boolean {
  // Same reference
  if (a === b) return true

  // Different types
  if (typeof a !== typeof b) return false

  // Null checks
  if (a === null || b === null) return a === b

  // Handle dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    return keysA.every(key => {
      return keysB.includes(key) && deepEqual(a[key], b[key])
    })
  }

  // Primitives
  return a === b
}
