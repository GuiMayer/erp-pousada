# Data Layer Architecture

## Overview

This document describes the data persistence layer implemented for the Pousada management system. Production mode now routes browser repositories through the internal `/api/data` API and persists mapped collections in PostgreSQL relational tables through Prisma.

## Architecture

### Core Components

```
lib/data/
├── types.ts                    # TypeScript interfaces and types
├── config.ts                   # Configuration for adapter selection
├── storage-adapter.ts          # localStorage implementation
├── local-database-adapter.ts   # Legacy JSONB adapter for migration/fallback
├── api-adapter.ts              # API implementation used by browser repositories
├── sync-manager.ts             # Multi-user synchronization
└── repositories/
    ├── base-repository.ts      # Abstract base class
    ├── [20 specific repositories]
    └── index.ts                # Factory and exports
```

### Key Concepts

**Repository Pattern**: Each entity type (Room, Reservation, Guest, etc.) has its own repository that handles CRUD operations and business logic.

**Storage Adapter**: Abstracts the storage mechanism (localStorage or API) so repositories don't need to know where data is stored.

**Metadata Tracking**: Every entity includes `_lastModified`, `_modifiedBy`, and `_version` for multi-user coordination.

**Event System**: Repositories emit events when data changes, enabling cross-tab synchronization.

## Usage

### Basic Usage

```typescript
import { useApp } from "@/lib/app-context"

function MyComponent() {
  const { rooms, addRoom, updateRoom, isLoading, isHydrated } = useApp()
  
  // Wait for data to load
  if (!isHydrated) {
    return <div>Loading...</div>
  }
  
  // Use data
  const handleAddRoom = async () => {
    await addRoom({
      id: 101,
      number: "101",
      type: "standard",
      status: "available",
      // ...
    })
  }
  
  return <div>{/* Your UI */}</div>
}
```

### Direct Repository Access

For advanced use cases, you can access repositories directly:

```typescript
import { createDataStore } from "@/lib/data/repositories"

const dataStore = createDataStore({ prefix: "pousada" })

// Query with filters
const availableRooms = await dataStore.rooms.findAvailable()
const overdueExpenses = await dataStore.expenses.findOverdue()

// Complex queries
const recentReservations = await dataStore.reservations.findByDateRange(
  startDate,
  endDate
)
```

## Repository Methods

All repositories inherit from `BaseRepository<T>` and provide:

### Standard CRUD
- `getAll()` - Get all entities
- `getById(id)` - Get entity by ID
- `create(entity)` - Create new entity
- `update(id, data)` - Update entity
- `delete(id)` - Delete entity
- `clear()` - Delete all entities

### Utility Methods
- `count()` - Count entities
- `exists(id)` - Check if entity exists
- `query(predicate)` - Filter entities with custom function

### Entity-Specific Methods

Each repository adds domain-specific methods:

**RoomRepository**
- `findByNumber(number)` - Find room by number
- `findByStatus(status)` - Find rooms by status
- `findAvailable()` - Find available rooms
- `findOccupied()` - Find occupied rooms

**ReservationRepository**
- `findByCPF(cpf)` - Find reservations by guest CPF
- `findByRoomId(roomId)` - Find reservations for a room
- `findActive()` - Find active reservations
- `findByDateRange(start, end)` - Find reservations in date range

**ExpenseRepository**
- `findByCategory(category)` - Find expenses by category
- `findUnpaid()` - Find unpaid expenses
- `findOverdue()` - Find overdue expenses

**TransactionRepository**
- `getTotalByType(type)` - Get total for transaction type
- `getBalance()` - Get current balance

See individual repository files for complete method lists.

## Data Persistence

### localStorage Strategy

`localStorage` is limited to demo/offline mode and UI preferences. It is not the normal production path.

When `NEXT_PUBLIC_DATA_ADAPTER=demo-localStorage`, data is stored in localStorage with the following characteristics:

- **Key Format**: `{prefix}:{entityName}` (e.g., `pousada:rooms`)
- **Serialization**: JSON with automatic date handling
- **Debouncing**: Writes are debounced by 100ms to reduce I/O
- **Quota Management**: Automatic cleanup when approaching 5MB limit
- **Cross-tab Sync**: Storage events enable real-time sync between tabs

### PostgreSQL Strategy

Production data uses PostgreSQL through Next.js API routes. Browser repositories still use the existing repository abstraction, but the `DatabaseApiAdapter` sends reads and writes to `/api/data`. The server maps each collection key to explicit Prisma tables.

- **Browser adapter**: `lib/data/database-api-adapter.ts`
- **Server API**: `app/api/data/**`
- **Relational service**: `lib/server/db/relational-data-service.ts`
- **Mappers**: `lib/server/db/mappers.ts`
- **Client**: `lib/db/client.ts`
- **Schema**: `prisma/schema.prisma`
- **Relational tables**: rooms, reservations, finance, POS, restaurant, stock, employees, users, settings, audit
- **Legacy table**: `local_data_entries` remains only for fallback and migration compatibility
- **Default local URL**: `postgresql://pousada:pousada@localhost:5432/pousada`
- **Runtime scope**: Prisma stays server-side; do not import it in client components
- **Cloud path**: keep repository code unchanged, then point `DATABASE_URL` to a managed PostgreSQL provider when needed

Start a local database with Docker:

```bash
docker compose up -d postgres
pnpm db:migrate
```

Equivalent package scripts:

```bash
pnpm db:up
pnpm db:migrate
pnpm db:logs
pnpm db:down
```

Docker Desktop or another Docker daemon must be running before `pnpm db:up` can start PostgreSQL.

Useful commands:

```bash
pnpm db:generate
pnpm db:migrate -- --name your_migration_name
pnpm db:studio
pnpm db:seed
pnpm db:reset
```

Relational collection API examples:

```typescript
// Browser-side repository calls use the same methods as before.
await dataStore.rooms.create(room)
await dataStore.rooms.update(room.id, { status: "ocupado" })

// Server-side collection access is available for tooling/migration.
import { getCollection, replaceCollection } from "@/lib/server/db/relational-data-service"

const rooms = await getCollection("rooms")
await replaceCollection("rooms", rooms)
```

### Legacy JSON Migration

Older versions stored production collections in the `local_data_entries` JSONB table. Use the migration tool after applying relational migrations:

```bash
pnpm db:migrate-local-data
```

The Windows maintenance menu also exposes `Migrar dados legados para tabelas relacionais`. It creates a backup before running the migration.

This migration copies recognized collection keys into relational tables. It does not delete `local_data_entries`; keep it until the converted data is verified.

### Storage Limits

- **localStorage quota**: ~5-10MB depending on browser
- **Monitoring**: Use `getStorageUsage()` to check current usage
- **Cleanup**: Automatic when reaching 80% of quota

### Data Export/Import

```typescript
const { exportData, importData, clearAllData } = useApp()

// Export all data as JSON
const json = await exportData()
// Save to file or send to server

// Import data from JSON
await importData(json)

// Clear all data (use with caution!)
await clearAllData()
```

## Multi-User Support

### Metadata Tracking

Every entity includes:
```typescript
interface EntityMetadata {
  _lastModified: number      // Timestamp
  _modifiedBy: string        // User ID
  _version: number           // Version counter
}
```

### Conflict Resolution

The system uses "last write wins" strategy:
1. Compare `_lastModified` timestamps
2. Keep the version with the latest timestamp
3. Log conflicts for review

```typescript
import { SyncManager } from "@/lib/data/sync-manager"

// Resolve conflicts between local and remote data
const result = SyncManager.resolveConflicts(localData, remoteData)

console.log(`Resolved: ${result.resolved.length}`)
console.log(`Conflicts: ${result.conflicts.length}`)
```

## Cross-Tab Synchronization

The system automatically synchronizes data across browser tabs:

1. **Storage Events**: Native browser events when localStorage changes
2. **Custom Events**: Repository emits events for same-tab changes
3. **Auto-Reload**: Data automatically reloads when changes detected

```typescript
// Handled automatically by useDataStore hook
const { isSyncing } = useApp()

if (isSyncing) {
  // Show sync indicator
}
```

## Migration to Backend API

The architecture is designed for easy migration to a backend API:

### Step 1: Implement API Adapter

The stub is already in place at `lib/data/api-adapter.ts`. Implement the methods to call your backend:

```typescript
export class ApiAdapter implements IStorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    const response = await fetch(`${this.baseUrl}/${key}`)
    return response.json()
  }
  
  async set<T>(key: string, value: T): Promise<void> {
    await fetch(`${this.baseUrl}/${key}`, {
      method: 'PUT',
      body: JSON.stringify(value)
    })
  }
  
  // ... implement other methods
}
```

### Step 2: Update Configuration

Set environment variable to switch adapters:

```bash
# .env.local
NEXT_PUBLIC_DATA_ADAPTER=database
NEXT_PUBLIC_API_URL=https://api.pousada.com
NEXT_PUBLIC_API_TOKEN=your-token
```

### Step 3: No Code Changes Required

All application code continues to work unchanged because it uses the repository abstraction.

## Backend API Specification

When implementing the backend, follow this API structure:

### Endpoints

```
GET    /api/{entity}           # Get all entities
GET    /api/{entity}/{id}      # Get entity by ID
POST   /api/{entity}           # Create entity
PUT    /api/{entity}/{id}      # Update entity
DELETE /api/{entity}/{id}      # Delete entity

GET    /api/keys               # Get all entity keys
POST   /api/clear              # Clear all data
GET    /api/export             # Export all data
POST   /api/import             # Import data
GET    /api/usage              # Get storage usage
```

### Entity Names

- `rooms`, `reservations`, `guests`, `expenses`, `transactions`
- `auditLog`, `categories`, `cashCloses`, `consumptions`
- `posProducts`, `posSales`, `productCategories`
- `restaurantTables`, `restaurantOrders`
- `stockItems`, `stockMovements`, `recipes`, `productions`
- `employees`, `employeeConsumptions`

### Request/Response Format

**Create/Update Request:**
```json
{
  "id": "R001",
  "number": "101",
  "type": "standard",
  "status": "available",
  "_lastModified": 1234567890,
  "_modifiedBy": "user123",
  "_version": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* entity */ }
}
```

## Performance Considerations

### Caching

Repositories use in-memory caching by default:
- Cache is invalidated on write operations
- Cache can be disabled per repository if needed

### Indexing

For large datasets, repositories support indexed queries:
- CPF lookups use Map for O(1) access
- Date range queries use binary search
- Status filters use pre-computed indices

### Pagination

For future scalability, the repository interface includes pagination support:

```typescript
interface QueryOptions {
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

const result = await repository.query(
  (item) => item.status === 'active',
  { limit: 20, offset: 0 }
)
```

## Validation

All repositories validate data before persistence:

```typescript
// Validation happens automatically
await dataStore.rooms.create(room)  // Throws if invalid

// Validation uses lib/utils/validators.ts
import { validateRoom } from "@/lib/utils/validators"

const result = validateRoom(room)
if (!result.valid) {
  console.error(result.error)
}
```

## Testing

### Unit Tests

Test repositories in isolation:

```typescript
import { RoomRepository } from "@/lib/data/repositories/room-repository"
import { LocalStorageAdapter } from "@/lib/data/storage-adapter"

describe('RoomRepository', () => {
  let repo: RoomRepository
  
  beforeEach(() => {
    const adapter = new LocalStorageAdapter({ prefix: 'test' })
    repo = new RoomRepository(adapter)
  })
  
  it('should create a room', async () => {
    const room = await repo.create({ /* ... */ })
    expect(room.id).toBeDefined()
  })
})
```

### Integration Tests

Test the full data flow:

```typescript
import { createDataStore } from "@/lib/data/repositories"

describe('Data Store', () => {
  it('should persist data across reloads', async () => {
    const store1 = createDataStore({ prefix: 'test' })
    await store1.rooms.create({ /* ... */ })
    
    const store2 = createDataStore({ prefix: 'test' })
    const rooms = await store2.rooms.getAll()
    expect(rooms).toHaveLength(1)
  })
})
```

## Troubleshooting

### Data Not Persisting

1. Check browser localStorage quota
2. Verify no errors in console
3. Check `isHydrated` state before using data

### Cross-Tab Sync Not Working

1. Ensure both tabs use same storage prefix
2. Check browser supports storage events
3. Verify no errors in sync event handlers

### Performance Issues

1. Check storage usage with `getStorageUsage()`
2. Consider clearing old audit logs
3. Enable pagination for large lists

## Migration Guide

### From Old AppContext

The new AppContext maintains the same API, so most code works unchanged:

**Before:**
```typescript
const { rooms, addRoom } = useApp()
addRoom(room)  // Synchronous
```

**After:**
```typescript
const { rooms, addRoom } = useApp()
await addRoom(room)  // Now async
```

All methods are now async to support future API backend.

## Summary

The data layer provides:

✅ **Persistent Storage**: Data survives page reloads  
✅ **Type Safety**: Full TypeScript support  
✅ **Validation**: Automatic data validation  
✅ **Multi-User**: Conflict detection and resolution  
✅ **Cross-Tab Sync**: Real-time synchronization  
✅ **Future-Proof**: Easy migration to backend API  
✅ **Performance**: Caching and indexing built-in  
✅ **Developer Experience**: Clean, intuitive API  

For questions or issues, refer to the source code in `lib/data/` or check the inline documentation.
