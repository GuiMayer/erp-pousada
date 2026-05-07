/**
 * Sync Manager
 * 
 * Manages multi-user synchronization with "last write wins" strategy.
 * Detects conflicts and provides metadata tracking.
 */

import type { EntityMetadata } from "./types"

export interface SyncConflict<T> {
  entityId: string | number
  localVersion: T & EntityMetadata
  remoteVersion: T & EntityMetadata
  conflictType: 'version' | 'timestamp' | 'concurrent'
}

export interface SyncResult<T> {
  resolved: (T & EntityMetadata)[]
  conflicts: SyncConflict<T>[]
}

/**
 * Sync Manager for multi-user coordination
 */
export class SyncManager {
  /**
   * Add metadata to an entity
   */
  static addMetadata<T>(
    entity: T,
    userId?: string
  ): T & EntityMetadata {
    const now = Date.now()
    
    return {
      ...entity,
      _lastModified: now,
      _modifiedBy: userId || 'anonymous',
      _version: 1
    }
  }

  /**
   * Update metadata on an entity
   */
  static updateMetadata<T extends EntityMetadata>(
    entity: T,
    userId?: string
  ): T {
    const now = Date.now()
    
    return {
      ...entity,
      _lastModified: now,
      _modifiedBy: userId || 'anonymous',
      _version: (entity._version || 0) + 1
    }
  }

  /**
   * Resolve conflicts using "last write wins" strategy
   * 
   * @param local - Local entities with metadata
   * @param remote - Remote entities with metadata
   * @returns Resolved entities and detected conflicts
   */
  static resolveConflicts<T extends { id: string | number }>(
    local: (T & EntityMetadata)[],
    remote: (T & EntityMetadata)[]
  ): SyncResult<T> {
    const resolved: (T & EntityMetadata)[] = []
    const conflicts: SyncConflict<T>[] = []

    // Create maps for efficient lookup
    const localMap = new Map(local.map(e => [e.id, e]))
    const remoteMap = new Map(remote.map(e => [e.id, e]))

    // Get all unique IDs
    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

    for (const id of allIds) {
      const localEntity = localMap.get(id)
      const remoteEntity = remoteMap.get(id)

      // Only in local - keep it
      if (localEntity && !remoteEntity) {
        resolved.push(localEntity)
        continue
      }

      // Only in remote - take it
      if (!localEntity && remoteEntity) {
        resolved.push(remoteEntity)
        continue
      }

      // In both - resolve conflict
      if (localEntity && remoteEntity) {
        const conflict = this.detectConflict(localEntity, remoteEntity)
        
        if (conflict) {
          conflicts.push({
            entityId: id,
            localVersion: localEntity,
            remoteVersion: remoteEntity,
            conflictType: conflict
          })
        }

        // Last write wins
        const winner = localEntity._lastModified > remoteEntity._lastModified
          ? localEntity
          : remoteEntity

        resolved.push(winner)
      }
    }

    return { resolved, conflicts }
  }

  /**
   * Detect conflict type between two versions
   */
  private static detectConflict<T extends EntityMetadata>(
    local: T,
    remote: T
  ): 'version' | 'timestamp' | 'concurrent' | null {
    // No conflict if timestamps are identical
    if (local._lastModified === remote._lastModified) {
      return null
    }

    // Version conflict - different versions
    if (local._version !== remote._version) {
      return 'version'
    }

    // Timestamp conflict - same version but different timestamps
    const timeDiff = Math.abs(local._lastModified - remote._lastModified)
    
    // Concurrent if modified within 1 second of each other
    if (timeDiff < 1000) {
      return 'concurrent'
    }

    return 'timestamp'
  }

  /**
   * Merge two entities, preferring non-null values from the newer one
   */
  static merge<T extends EntityMetadata>(
    older: T,
    newer: T
  ): T {
    const merged = { ...older }

    // Merge all properties from newer, skipping null/undefined
    for (const key in newer) {
      const newerValue = newer[key]
      if (newerValue !== null && newerValue !== undefined) {
        merged[key] = newerValue
      }
    }

    // Update metadata to reflect merge
    merged._lastModified = Math.max(older._lastModified, newer._lastModified)
    merged._version = Math.max(older._version || 0, newer._version || 0) + 1
    merged._modifiedBy = newer._modifiedBy

    return merged
  }

  /**
   * Check if an entity has been modified by another user
   */
  static isModifiedByOther<T extends EntityMetadata>(
    entity: T,
    currentUserId?: string
  ): boolean {
    if (!currentUserId) return false
    return entity._modifiedBy !== currentUserId
  }

  /**
   * Get conflict summary for logging
   */
  static getConflictSummary<T>(conflicts: SyncConflict<T>[]): string {
    if (conflicts.length === 0) {
      return 'No conflicts detected'
    }

    const byType = conflicts.reduce((acc, c) => {
      acc[c.conflictType] = (acc[c.conflictType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const summary = Object.entries(byType)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ')

    return `${conflicts.length} conflicts: ${summary}`
  }
}
