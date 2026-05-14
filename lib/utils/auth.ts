/**
 * Authentication utilities with secure password hashing
 * Uses bcryptjs for password hashing and verification
 */

import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns True if password matches hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate initial hashed passwords for default users
 * This should be run once during setup to generate hashed passwords
 */
export async function generateDefaultPasswordHashes(): Promise<{
  supervisor: string
  operador: string
}> {
  const [supervisorHash, operadorHash] = await Promise.all([
    hashPassword('adm123'),
    hashPassword('1234')
  ])
  
  return {
    supervisor: supervisorHash,
    operador: operadorHash
  }
}

/**
 * Pre-generated hashed passwords for default users
 * These were generated using bcrypt with 10 salt rounds
 * 
 * IMPORTANT: In production, these should be changed immediately
 * and stored securely in environment variables or a secure database
 */
export const DEFAULT_PASSWORD_HASHES = {
  // Hash for 'adm123'
  supervisor: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  // Hash for '1234'
  operador: '$2a$10$JQ95SiNo5nMtE8uCioUCZOqgTEn.bLT/bvbh4cyDgbcTmVcfeadqC'
}
