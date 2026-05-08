/**
 * Audit Repository Tests
 * 
 * Tests for audit log immutability guarantees
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AuditRepository } from '@/lib/data/repositories/audit-repository'
import type { AuditEntry } from '@/lib/store'
import type { IStorageAdapter } from '@/lib/data/types'

/**
 * Simple in-memory storage adapter for testing
 */
class MockStorageAdapter implements IStorageAdapter {
  private storage: Map<string, any> = new Map()

  async get<T>(key: string): Promise<T | null> {
    return this.storage.get(key) ?? null
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.storage.set(key, value)
  }

  async remove(key: string): Promise<void> {
    this.storage.delete(key)
  }

  async clear(): Promise<void> {
    this.storage.clear()
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys())
  }
}

describe('AuditRepository', () => {
  let repository: AuditRepository
  let adapter: MockStorageAdapter

  beforeEach(() => {
    adapter = new MockStorageAdapter()
    repository = new AuditRepository(adapter, 'test-user')
  })

  describe('Immutability Guarantees', () => {
    it('should throw error when attempting to update an audit entry', async () => {
      // Create an audit entry
      const entry = await repository.create({
        user: 'test-user',
        action: 'Test action',
        reference: 'Test reference',
        date: new Date().toISOString()
      })

      // Attempt to update should throw
      await expect(
        repository.update(entry.id, { action: 'Modified action' })
      ).rejects.toThrow('Audit entries are immutable and cannot be modified')
    })

    it('should throw error when attempting to delete an audit entry', async () => {
      // Create an audit entry
      const entry = await repository.create({
        user: 'test-user',
        action: 'Test action',
        reference: 'Test reference',
        date: new Date().toISOString()
      })

      // Attempt to delete should throw
      await expect(
        repository.delete(entry.id)
      ).rejects.toThrow('Audit entries are immutable and cannot be deleted')
    })

    it('should throw error when attempting to clear without force flag', async () => {
      // Create some audit entries
      await repository.create({
        user: 'test-user',
        action: 'Test action 1',
        reference: 'Test reference 1',
        date: new Date().toISOString()
      })
      await repository.create({
        user: 'test-user',
        action: 'Test action 2',
        reference: 'Test reference 2',
        date: new Date().toISOString()
      })

      // Attempt to clear without force should throw
      await expect(
        repository.clear()
      ).rejects.toThrow('Audit log cannot be cleared. Use clear({ force: true }) only in development.')
    })

    it('should allow clear with force flag (for testing)', async () => {
      // Create some audit entries
      await repository.create({
        user: 'test-user',
        action: 'Test action 1',
        reference: 'Test reference 1',
        date: new Date().toISOString()
      })
      await repository.create({
        user: 'test-user',
        action: 'Test action 2',
        reference: 'Test reference 2',
        date: new Date().toISOString()
      })

      // Verify entries exist
      const beforeClear = await repository.getAll()
      expect(beforeClear.length).toBe(2)

      // Clear with force should work
      await expect(
        repository.clear({ force: true })
      ).resolves.not.toThrow()

      // Verify entries are cleared
      const afterClear = await repository.getAll()
      expect(afterClear.length).toBe(0)
    })
  })

  describe('Basic Operations', () => {
    it('should create audit entries successfully', async () => {
      const entry = await repository.create({
        user: 'test-user',
        action: 'Test action',
        reference: 'Test reference',
        date: new Date().toISOString()
      })

      expect(entry.id).toBeDefined()
      expect(entry.date).toBeDefined()
      expect(entry.user).toBe('test-user')
      expect(entry.action).toBe('Test action')
      expect(entry.reference).toBe('Test reference')
    })

    it('should create detailed audit entries with metadata', async () => {
      const entry = await repository.create({
        user: 'test-user',
        action: 'Transaction created',
        reference: 'Transaction #123',
        date: new Date().toISOString(),
        entityType: 'Transaction',
        entityId: '123',
        operation: 'create',
        metadata: {
          after: { id: '123', value: 100 },
          duration: 50
        }
      })

      expect(entry.entityType).toBe('Transaction')
      expect(entry.entityId).toBe('123')
      expect(entry.operation).toBe('create')
      expect(entry.metadata).toBeDefined()
      expect(entry.metadata?.after).toEqual({ id: '123', value: 100 })
      expect(entry.metadata?.duration).toBe(50)
    })

    it('should retrieve all audit entries', async () => {
      await repository.create({
        user: 'user1',
        action: 'Action 1',
        reference: 'Ref 1',
        date: new Date().toISOString()
      })
      await repository.create({
        user: 'user2',
        action: 'Action 2',
        reference: 'Ref 2',
        date: new Date().toISOString()
      })

      const entries = await repository.getAll()
      expect(entries.length).toBe(2)
    })

    it('should find entries by user', async () => {
      await repository.create({
        user: 'user1',
        action: 'Action 1',
        reference: 'Ref 1',
        date: new Date().toISOString()
      })
      await repository.create({
        user: 'user2',
        action: 'Action 2',
        reference: 'Ref 2',
        date: new Date().toISOString()
      })
      await repository.create({
        user: 'user1',
        action: 'Action 3',
        reference: 'Ref 3',
        date: new Date().toISOString()
      })

      const user1Entries = await repository.findByUser('user1')
      expect(user1Entries.length).toBe(2)
      expect(user1Entries.every(e => e.user === 'user1')).toBe(true)
    })

    it('should find entries by action', async () => {
      await repository.create({
        user: 'user1',
        action: 'Check-in',
        reference: 'Room 101',
        date: new Date().toISOString()
      })
      await repository.create({
        user: 'user2',
        action: 'Check-out',
        reference: 'Room 102',
        date: new Date().toISOString()
      })
      await repository.create({
        user: 'user1',
        action: 'Check-in',
        reference: 'Room 103',
        date: new Date().toISOString()
      })

      const checkinEntries = await repository.findByAction('Check-in')
      expect(checkinEntries.length).toBe(2)
      expect(checkinEntries.every(e => e.action === 'Check-in')).toBe(true)
    })

    it('should get recent entries sorted by date', async () => {
      // Create entries with different dates to ensure proper sorting
      const now = Date.now()
      
      const entry1 = await repository.create({
        user: 'user1',
        action: 'Action 1',
        reference: 'Ref 1',
        date: new Date(now - 2000).toISOString()
      })

      const entry2 = await repository.create({
        user: 'user2',
        action: 'Action 2',
        reference: 'Ref 2',
        date: new Date(now - 1000).toISOString()
      })

      const entry3 = await repository.create({
        user: 'user3',
        action: 'Action 3',
        reference: 'Ref 3',
        date: new Date(now).toISOString()
      })

      const recent = await repository.getRecent(2)
      expect(recent.length).toBe(2)
      // Most recent should be first
      expect(recent[0].id).toBe(entry3.id)
      expect(recent[1].id).toBe(entry2.id)
    })
  })
})
